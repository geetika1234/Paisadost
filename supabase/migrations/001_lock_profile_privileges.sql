-- ============================================================
-- 001 — Lock profile privileges (Batch 1, step 1)
--
-- Closes two privilege-escalation holes in auth_setup.sql:
--   1. profiles_update allows `id = auth.uid()` with no WITH CHECK, so any
--      user could PATCH their own row to role='admin', is_approved=true.
--   2. profiles_insert only checks `id = auth.uid()`, so a fresh signup
--      could insert its own profile already as an approved admin.
--
-- Enforced with a trigger rather than policy subqueries: one place, explicit
-- error codes, and it also covers INSERT. Requests without an end-user JWT
-- (SQL Editor, service role) are trusted, so first-admin bootstrap via SQL
-- keeps working.
--
-- Additive and idempotent: safe to run more than once.
-- ============================================================

BEGIN;

-- ── Helpers: pin search_path on SECURITY DEFINER functions ───────────────────
-- Without it, a definer function resolves names through the caller's
-- search_path, which a malicious session could point at its own objects.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.am_i_approved()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE id = auth.uid()), false)
$$;

-- ── Guard trigger ────────────────────────────────────────────────────────────
--
--   caller                     INSERT                     UPDATE role/is_approved/mobile
--   ------------------------   ------------------------   ------------------------------
--   no JWT (SQL editor/svc)    as given                   allowed
--   approved admin             forced sales/unapproved    allowed (not on own row)
--   anyone else                forced sales/unapproved    rejected (42501)
--
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Every self-signup starts as an unapproved sales user, whatever the client sent.
    NEW.role        := 'sales';
    NEW.is_approved := false;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile_id_immutable' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO caller_role
    FROM public.profiles
   WHERE id = auth.uid() AND is_approved;

  IF caller_role = 'admin' THEN
    -- An admin demoting or unapproving themselves can lock everyone out.
    IF NEW.id = auth.uid() AND (NEW.role <> 'admin' OR NOT NEW.is_approved) THEN
      RAISE EXCEPTION 'admin_self_demotion_blocked' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- mobile is the login identifier; changing it would let a user pose as someone else in admin views.
  IF NEW.role        IS DISTINCT FROM OLD.role
  OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
  OR NEW.mobile      IS DISTINCT FROM OLD.mobile THEN
    RAISE EXCEPTION 'profile_privilege_change_denied' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_privileges ON public.profiles;
CREATE TRIGGER profiles_guard_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

COMMIT;

-- ── Review who holds privileges today ────────────────────────────────────────
-- The hole was open until now. Check this list: anyone you did not promote
-- yourself should be demoted from the Admin Panel.
SELECT id, fullname, mobile, role, is_approved, created_at
  FROM public.profiles
 WHERE role <> 'sales' OR is_approved
 ORDER BY role, created_at;
