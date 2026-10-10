-- ============================================================
-- 014 — A visit needs 2 photos (was 3, set in 008)
--
-- The app's visit form asks for MIN_VISIT_PHOTOS (src/logic/stages.js);
-- keep the two in step. Run this BEFORE deploying the app that asks for 2,
-- or 2-photo visits would be refused by the database.
-- ============================================================

UPDATE public.stage_defs SET min_photos = 2 WHERE key = 'visited';

SELECT key, min_photos FROM public.stage_defs WHERE key = 'visited';
