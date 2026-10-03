-- ============================================================
-- 008 — Lock stage writes (Batch 2, part B)
--
-- Run ONLY AFTER the Batch 2 app is deployed. The previous app sends `stage`
-- in its inserts/updates and its Quick Create writes a photo-less visit_done;
-- both would start failing here.
--
-- After this:
--   • the app cannot write customers.stage / stage_rank / status / status_reason
--     (column privileges); only the SECURITY DEFINER triggers can
--   • a visit only counts (stage → visited) with at least 3 photos
-- ============================================================

BEGIN;

-- ── 1. Evidence gate: 3 photos for a visit ───────────────────────────────────
UPDATE public.stage_defs SET min_photos = 3 WHERE key = 'visited';

-- ── 2. Column-level privileges on customers ──────────────────────────────────
-- A table-level grant covers every column, so revoke it and grant back only
-- the columns the app may write.
-- NOTE: a column added to customers later is NOT writable by the app until it
-- is added to these lists.
REVOKE INSERT, UPDATE ON public.customers FROM authenticated;

GRANT INSERT (name, mobile, shop_name, owner_name, area, landmark,
              business_type, intent_level, assigned_to, next_followup_at)
  ON public.customers TO authenticated;

GRANT UPDATE (name, mobile, shop_name, owner_name, area, landmark,
              business_type, intent_level, assigned_to, next_followup_at)
  ON public.customers TO authenticated;

COMMIT;
