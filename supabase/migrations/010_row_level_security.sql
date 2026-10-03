-- ============================================================
-- 010 — Each agent sees only their own leads (Batch 3)
--
--   who                     customers / events / reminders / loans / history
--   ----------------------  -----------------------------------------------
--   approved admin/manager  all leads
--   approved sales          leads where assigned_to = them
--   unapproved / anon       nothing
--
-- Writes follow the same rule. Deleting leads still goes only through
-- delete_customer() (006); stage/status only through the event triggers
-- (007/009). The app needs no change for this migration: Batch 1 made lead
-- creation, duplicate-mobile checks and deletion RLS-safe.
--
-- Rollback (per table): ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- ============================================================

BEGIN;

-- ── Helper: may the caller see this lead? ────────────────────────────────────
-- SECURITY DEFINER so child-table policies can check the parent lead without
-- recursing through customers' own RLS.
CREATE OR REPLACE FUNCTION public.can_access_customer(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.am_i_approved() AND (
       public.get_my_role() IN ('admin', 'manager')
    OR EXISTS (SELECT 1 FROM public.customers c
                WHERE c.customer_id = p_customer_id AND c.assigned_to = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_customer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_customer(UUID) TO authenticated;

-- ── customers ────────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;

CREATE POLICY "customers_select" ON public.customers FOR SELECT
  USING (public.am_i_approved() AND (assigned_to = auth.uid() OR public.get_my_role() IN ('admin', 'manager')));

-- assigned_to defaults to the creator (003), so an agent's own insert passes.
CREATE POLICY "customers_insert" ON public.customers FOR INSERT
  WITH CHECK (public.am_i_approved() AND (assigned_to = auth.uid() OR public.get_my_role() IN ('admin', 'manager')));

-- WITH CHECK stops an agent from handing their lead to someone else.
CREATE POLICY "customers_update" ON public.customers FOR UPDATE
  USING      (public.am_i_approved() AND (assigned_to = auth.uid() OR public.get_my_role() IN ('admin', 'manager')))
  WITH CHECK (public.am_i_approved() AND (assigned_to = auth.uid() OR public.get_my_role() IN ('admin', 'manager')));

-- ── events ───────────────────────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;

CREATE POLICY "events_select" ON public.events FOR SELECT USING (public.can_access_customer(customer_id));
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (public.can_access_customer(customer_id));
CREATE POLICY "events_update" ON public.events FOR UPDATE
  USING (public.can_access_customer(customer_id)) WITH CHECK (public.can_access_customer(customer_id));
-- No DELETE policy: the event log is append-only from the app.

-- ── reminders ────────────────────────────────────────────────────────────────
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_all" ON public.reminders;
CREATE POLICY "reminders_all" ON public.reminders FOR ALL
  USING (public.can_access_customer(customer_id)) WITH CHECK (public.can_access_customer(customer_id));

-- ── loans ────────────────────────────────────────────────────────────────────
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans_select" ON public.loans;
DROP POLICY IF EXISTS "loans_insert" ON public.loans;
DROP POLICY IF EXISTS "loans_update" ON public.loans;

CREATE POLICY "loans_select" ON public.loans FOR SELECT USING (public.can_access_customer(customer_id));
CREATE POLICY "loans_insert" ON public.loans FOR INSERT WITH CHECK (public.can_access_customer(customer_id));
CREATE POLICY "loans_update" ON public.loans FOR UPDATE
  USING (public.can_access_customer(customer_id)) WITH CHECK (public.can_access_customer(customer_id));

-- ── repayments ───────────────────────────────────────────────────────────────
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repayments_all" ON public.repayments;
CREATE POLICY "repayments_all" ON public.repayments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.loans l
                  WHERE l.loan_id = repayments.loan_id AND public.can_access_customer(l.customer_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.loans l
                       WHERE l.loan_id = repayments.loan_id AND public.can_access_customer(l.customer_id)));

-- ── stage_history: narrow from "any approved user" (007) to the lead's viewers ─
DROP POLICY IF EXISTS "stage_history_read" ON public.stage_history;
CREATE POLICY "stage_history_read" ON public.stage_history FOR SELECT
  USING (public.can_access_customer(customer_id));

COMMIT;

-- ── After enabling: leads with no owner are now visible only to admins/managers.
-- Assign them from the Admin Panel.
SELECT COUNT(*) AS unowned_leads_visible_only_to_admins
  FROM public.customers
 WHERE assigned_to IS NULL;
