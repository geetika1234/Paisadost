-- ============================================================
-- 011 — Desktop admin console data (Batch 4)
--
--   lead_summary            one row per lead with owner name, last activity
--                           and next follow-up; RLS of the caller applies
--   admin_today_summary()   everything the Today page shows, in one call
--   log_admin_action()      audit trail for admin actions done from the app
--
-- Safe to run while the current app is live (additive only).
-- ============================================================

BEGIN;

-- ── lead_summary ─────────────────────────────────────────────────────────────
-- security_invoker: the view runs with the CALLER's rights, so the RLS rules
-- from 010 still apply (an agent querying it sees only their own leads).
-- Without it a view runs as its owner and would expose every lead.
CREATE OR REPLACE VIEW public.lead_summary
WITH (security_invoker = true) AS
SELECT
  c.customer_id,
  c.shop_name,
  c.owner_name,
  c.mobile,
  c.area,
  c.landmark,
  c.business_type,
  c.stage,
  c.stage_rank,
  c.status,
  c.status_reason,
  c.assigned_to,
  p.fullname                                   AS assignee_name,
  c.created_at,
  GREATEST(c.created_at, le.last_event_at)     AS last_activity_at,
  nr.next_followup_at,
  COALESCE(nr.next_followup_at < NOW(), false) AS followup_overdue
FROM public.customers c
LEFT JOIN public.profiles p ON p.id = c.assigned_to
LEFT JOIN LATERAL (
  SELECT MAX(e.created_at) AS last_event_at          -- events_customer_idx
    FROM public.events e
   WHERE e.customer_id = c.customer_id
) le ON true
LEFT JOIN LATERAL (
  SELECT MIN(r.due_at) AS next_followup_at           -- reminders_customer_idx
    FROM public.reminders r
   WHERE r.customer_id = c.customer_id AND r.status = 'pending'
) nr ON true;

REVOKE ALL ON public.lead_summary FROM anon;
GRANT SELECT ON public.lead_summary TO authenticated;

CREATE INDEX IF NOT EXISTS customers_created_idx ON public.customers (created_at DESC);
CREATE INDEX IF NOT EXISTS customers_area_idx    ON public.customers (lower(area));

-- ── admin_today_summary ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_today_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month   TIMESTAMPTZ := date_trunc('month', NOW());
  v_dormant TIMESTAMPTZ := NOW() - INTERVAL '60 days';
  v_open    CONSTANT TEXT[] := ARRAY['active', 'nurture'];
  v_closed  CONSTANT TEXT[] := ARRAY['not_qualified', 'lost', 'rejected', 'dormant'];
BEGIN
  IF NOT (public.am_i_approved() AND public.get_my_role() IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'generated_at', NOW(),

    'pending_users', (SELECT COUNT(*) FROM public.profiles WHERE NOT is_approved),

    'unowned_leads', (SELECT COUNT(*) FROM public.customers
                       WHERE assigned_to IS NULL AND status = ANY (v_open)),

    'dormant_candidates', (
      SELECT COUNT(*) FROM public.customers c
       WHERE c.status = ANY (v_open)
         AND c.created_at < v_dormant
         AND NOT EXISTS (SELECT 1 FROM public.events e
                          WHERE e.customer_id = c.customer_id AND e.created_at >= v_dormant)),

    'overdue_by_agent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('agent_id', t.agent_id, 'agent_name', t.agent_name, 'count', t.n)
                       ORDER BY t.n DESC)
        FROM (SELECT c.assigned_to AS agent_id, COALESCE(p.fullname, 'Unassigned') AS agent_name, COUNT(*) AS n
                FROM public.reminders r
                JOIN public.customers c ON c.customer_id = r.customer_id
                LEFT JOIN public.profiles p ON p.id = c.assigned_to
               WHERE r.status = 'pending' AND r.due_at < NOW() AND c.status = ANY (v_open)
               GROUP BY 1, 2) t
    ), '[]'::jsonb),

    'kpis', jsonb_build_object(
      'new_leads', (SELECT COUNT(*) FROM public.customers WHERE created_at >= v_month),
      'visits',    (SELECT COUNT(*) FROM public.events
                     WHERE event_type = 'visit_done' AND created_at >= v_month),
      'logins',    (SELECT COUNT(*) FROM public.stage_history
                     WHERE to_stage = 'login_started' AND from_stage IS DISTINCT FROM 'login_started'
                       AND changed_at >= v_month),
      'closed',    (SELECT COUNT(*) FROM public.stage_history
                     WHERE to_status = ANY (v_closed) AND NOT (COALESCE(from_status, '') = ANY (v_closed))
                       AND changed_at >= v_month)
    ),

    -- Of the leads created this month, how many reached each stage so far.
    'funnel', (
      SELECT jsonb_agg(jsonb_build_object(
               'key', d.key,
               'reached', (SELECT COUNT(*) FROM public.customers c
                            WHERE c.created_at >= v_month AND c.stage_rank >= d.rank))
             ORDER BY d.rank)
        FROM public.stage_defs d
       WHERE d.is_live
    ),

    'agents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'agent_id',     p.id,
               'agent_name',   p.fullname,
               'open_leads',   (SELECT COUNT(*) FROM public.customers c
                                 WHERE c.assigned_to = p.id AND c.status = ANY (v_open)),
               'visits_month', (SELECT COUNT(*) FROM public.events e
                                 WHERE e.created_by = p.id AND e.event_type = 'visit_done'
                                   AND e.created_at >= v_month),
               'logins_month', (SELECT COUNT(*) FROM public.stage_history h
                                 WHERE h.changed_by = p.id AND h.to_stage = 'login_started'
                                   AND h.from_stage IS DISTINCT FROM 'login_started'
                                   AND h.changed_at >= v_month),
               'overdue',      (SELECT COUNT(*) FROM public.reminders r
                                  JOIN public.customers c ON c.customer_id = r.customer_id
                                 WHERE c.assigned_to = p.id AND r.status = 'pending'
                                   AND r.due_at < NOW() AND c.status = ANY (v_open)))
             ORDER BY p.fullname)
        FROM public.profiles p
       WHERE p.is_approved AND p.role = 'sales'
    ), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_today_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_today_summary() TO authenticated;

-- ── log_admin_action ─────────────────────────────────────────────────────────
-- admin_audit_log has no INSERT policy (006); this is the only app path in.
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action TEXT, p_details JSONB DEFAULT '{}')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.am_i_approved() AND public.get_my_role() IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
  IF p_action !~ '^[a-z_]{3,40}$' THEN
    RAISE EXCEPTION 'audit_action_invalid' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, snapshot)
  VALUES (auth.uid(), p_action, COALESCE(p_details, '{}'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, JSONB) TO authenticated;

-- Managers read the audit log too (006 allowed admins only).
DROP POLICY IF EXISTS "audit_select_admin" ON public.admin_audit_log;
CREATE POLICY "audit_select_admin" ON public.admin_audit_log FOR SELECT
  USING (public.am_i_approved() AND public.get_my_role() IN ('admin', 'manager'));

COMMIT;
