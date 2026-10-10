-- ============================================================
-- 016 — Latest customer response on lead_summary
--
-- Adds latest_response ('interested' | 'thinking' | 'not_interested' | NULL)
-- so the admin Leads page can show and filter Soch Raha / Nahi leads without
-- opening each one. Soch Raha and Nahi never move the stage (only Interested
-- does, migration 015), so this column is the only place they show up.
--
-- Additive: the view keeps every column 011 defined, in the same order, with
-- the new one appended (CREATE OR REPLACE VIEW only allows adding at the end).
-- security_invoker stays on, so RLS from 010 still applies to the caller.
-- Run BEFORE deploying the app that reads the column.
-- ============================================================

BEGIN;

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
  COALESCE(nr.next_followup_at < NOW(), false) AS followup_overdue,
  lr.latest_response
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
) nr ON true
LEFT JOIN LATERAL (
  SELECT e.data ->> 'response' AS latest_response    -- events_customer_response_idx
    FROM public.events e
   WHERE e.customer_id = c.customer_id AND e.event_type = 'customer_response'
   ORDER BY e.created_at DESC
   LIMIT 1
) lr ON true;

REVOKE ALL ON public.lead_summary FROM anon;
GRANT SELECT ON public.lead_summary TO authenticated;

CREATE INDEX IF NOT EXISTS events_customer_response_idx
  ON public.events (customer_id, created_at DESC)
  WHERE event_type = 'customer_response';

COMMIT;

-- Sanity check: how many leads carry each latest response.
SELECT COALESCE(latest_response, '(none)') AS latest_response, COUNT(*) AS leads
  FROM public.lead_summary GROUP BY 1 ORDER BY 2 DESC;
