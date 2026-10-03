-- ============================================================
-- 005 — Cross-agent duplicate mobile lookup (Batch 1, step 3)
--
-- saveCustomer / checkMobileDuplicate find an existing lead by SELECTing on
-- mobile. Once RLS limits agents to their own leads, a colleague's lead is
-- invisible: the check says "free", the insert hits UNIQUE(mobile), and the
-- agent sees a raw "duplicate key" error.
--
-- This function answers "does this number exist, and whose is it?" without
-- exposing the other lead's row. customer_id is only returned to callers who
-- may open the lead (its owner, managers, admins).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.find_customer_by_mobile(p_mobile TEXT)
RETURNS TABLE (
  customer_id UUID,      -- NULL unless the caller may open this lead
  is_mine     BOOLEAN,
  can_edit    BOOLEAN,
  owner_name  TEXT       -- NULL when the lead has no owner
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_mobile TEXT := NULLIF(trim(p_mobile), '');
  v_role   TEXT;
BEGIN
  -- Unapproved signups must not be able to probe which numbers are customers.
  IF NOT public.am_i_approved() THEN
    RAISE EXCEPTION 'not_approved' USING ERRCODE = '42501';
  END IF;

  IF v_mobile IS NULL THEN
    RETURN;
  END IF;

  v_role := public.get_my_role();

  RETURN QUERY
  SELECT
    CASE WHEN c.assigned_to = auth.uid() OR v_role IN ('admin', 'manager')
         THEN c.customer_id END,
    COALESCE(c.assigned_to = auth.uid(), false),
    COALESCE(c.assigned_to = auth.uid(), false) OR v_role IN ('admin', 'manager'),
    p.fullname
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.id = c.assigned_to
  WHERE c.mobile = v_mobile
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.find_customer_by_mobile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_mobile(TEXT) TO authenticated;

COMMIT;
