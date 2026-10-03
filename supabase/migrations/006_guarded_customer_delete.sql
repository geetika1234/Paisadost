-- ============================================================
-- 006 — Guarded lead deletion + audit log (Batch 1, step 4)
--
-- Before: any logged-in user could hard-delete any lead, which cascades away
-- all its events, loans and repayments with no trace.
--
-- After: direct DELETE on customers is revoked. Deletion goes through
-- delete_customer(), which allows:
--   • admins: any lead
--   • the lead's owner: only within 24h of creating it (keeps the existing
--     "undo a mistaken lead today" button on the Dashboard working)
-- Every deletion writes a snapshot to admin_audit_log first.
-- ============================================================

BEGIN;

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,          -- e.g. 'customer_deleted'
  entity_id   UUID,
  snapshot    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON public.admin_audit_log;
CREATE POLICY "audit_select_admin" ON public.admin_audit_log FOR SELECT
  USING (public.am_i_approved() AND public.get_my_role() = 'admin');
-- No INSERT/UPDATE/DELETE policies: rows are written only by SECURITY DEFINER
-- functions, and nobody can edit or erase history from the client.

REVOKE ALL ON public.admin_audit_log FROM anon;

-- ── delete_customer ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_customer(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_customer public.customers%ROWTYPE;
BEGIN
  IF NOT public.am_i_approved() THEN
    RAISE EXCEPTION 'not_approved' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_my_role();

  SELECT * INTO v_customer
    FROM public.customers
   WHERE customer_id = p_customer_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
       v_role = 'admin'
    OR (v_customer.assigned_to = auth.uid() AND v_customer.created_at > NOW() - INTERVAL '24 hours')
  ) THEN
    RAISE EXCEPTION 'delete_not_allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_id, snapshot)
  VALUES (auth.uid(), 'customer_deleted', p_customer_id, to_jsonb(v_customer));

  DELETE FROM public.customers WHERE customer_id = p_customer_id;
END $$;

REVOKE ALL ON FUNCTION public.delete_customer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer(UUID) TO authenticated;

-- ── Close the direct path ────────────────────────────────────────────────────
REVOKE DELETE ON public.customers FROM authenticated, anon;

COMMIT;
