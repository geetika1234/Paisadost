-- ============================================================
-- 012 — Private storage for visit photos (Batch 4)
--
-- Before: photos go to the PUBLIC "photos" bucket and their permanent public
-- URL is saved in the visit event. Anyone holding a link can open it forever.
--
-- After: NEW photos go to the PRIVATE "visit-photos" bucket under
-- <customer_id>/..., and the visit stores a reference ("sb:visit-photos/<path>").
-- The app turns a reference into a signed link that expires after an hour,
-- and only for users who can see that lead (same rule as 010).
--
-- Existing photos stay in the public bucket and keep working; nothing is moved.
-- The logo also lives in "photos", so that bucket must stay public.
--
-- Run BEFORE deploying the Batch 4 app (it uploads to the new bucket).
-- ============================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visit-photos', 'visit-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The first folder of every object name is the lead's customer_id.
CREATE OR REPLACE FUNCTION public.can_access_photo_path(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder TEXT := split_part(p_name, '/', 1);
BEGIN
  IF v_folder !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN false;
  END IF;
  RETURN public.can_access_customer(v_folder::uuid);
END $$;

REVOKE ALL ON FUNCTION public.can_access_photo_path(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_photo_path(TEXT) TO authenticated;

DROP POLICY IF EXISTS "visit_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_upload" ON storage.objects;

CREATE POLICY "visit_photos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'visit-photos' AND public.can_access_photo_path(name));

CREATE POLICY "visit_photos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visit-photos' AND public.can_access_photo_path(name));
-- No UPDATE/DELETE policies: visit evidence cannot be replaced or removed from the app.

COMMIT;
