-- ============================================================
-- 013 — A lead's mobile cannot be a team member's number
--
-- Before: an agent could create a lead with their own (or a colleague's)
-- mobile; only other LEADS were checked for duplicates.
--
-- After:
--   • creating a lead, or changing a lead's mobile, to the number of an
--     APPROVED team member is refused (mobile_is_team_member), on every path
--   • find_customer_by_mobile() also reports is_team, so the form can warn
--     before the agent fills everything else
--
-- Only approved members count: otherwise anyone could sign up with a real
-- customer's number just to stop that customer being added as a lead.
-- Numbers are compared on their last 10 digits (+91, spaces, leading 0 ignored).
--
-- Safe to run while the current app is live. Existing leads are not changed;
-- the report at the end lists any that already use a team number.
-- ============================================================

BEGIN;

-- ── Helpers ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_mobile(p_mobile TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(right(regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g'), 10), '')
$$;

-- SECURITY DEFINER: agents cannot read other agents' profiles (RLS), and the
-- check must still see every approved member. Not callable from the app; it
-- only answers yes/no inside the functions below.
CREATE OR REPLACE FUNCTION public.is_team_mobile(p_mobile TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_mobile(p_mobile) IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.is_approved
                    AND public.normalize_mobile(p.mobile) = public.normalize_mobile(p_mobile))
$$;

REVOKE ALL ON FUNCTION public.is_team_mobile(TEXT) FROM PUBLIC, anon, authenticated;

-- ── Guard on customers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_customer_mobile()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mobile IS NULL THEN
    RETURN NEW;
  END IF;
  -- Editing other fields of an older lead that already has a team number is allowed;
  -- only setting or changing the mobile is checked.
  IF TG_OP = 'UPDATE' AND NEW.mobile IS NOT DISTINCT FROM OLD.mobile THEN
    RETURN NEW;
  END IF;
  IF public.is_team_mobile(NEW.mobile) THEN
    RAISE EXCEPTION 'mobile_is_team_member' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_guard_mobile ON public.customers;
CREATE TRIGGER customers_guard_mobile
  BEFORE INSERT OR UPDATE OF mobile ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_mobile();

-- ── find_customer_by_mobile: add is_team ─────────────────────────────────────
-- The return type changes, so the function is dropped and recreated (005).
DROP FUNCTION IF EXISTS public.find_customer_by_mobile(TEXT);

CREATE FUNCTION public.find_customer_by_mobile(p_mobile TEXT)
RETURNS TABLE (
  customer_id UUID,      -- NULL unless the caller may open this lead
  is_mine     BOOLEAN,
  can_edit    BOOLEAN,
  owner_name  TEXT,      -- NULL when the lead has no owner
  is_team     BOOLEAN    -- the number belongs to an approved team member
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_mobile TEXT := NULLIF(trim(p_mobile), '');
  v_role   TEXT;
BEGIN
  IF NOT public.am_i_approved() THEN
    RAISE EXCEPTION 'not_approved' USING ERRCODE = '42501';
  END IF;

  IF v_mobile IS NULL THEN
    RETURN;
  END IF;

  -- A team number is never a valid lead number: say so, and nothing else.
  IF public.is_team_mobile(v_mobile) THEN
    RETURN QUERY SELECT NULL::UUID, false, false, NULL::TEXT, true;
    RETURN;
  END IF;

  v_role := public.get_my_role();

  RETURN QUERY
  SELECT
    CASE WHEN c.assigned_to = auth.uid() OR v_role IN ('admin', 'manager')
         THEN c.customer_id END,
    COALESCE(c.assigned_to = auth.uid(), false),
    COALESCE(c.assigned_to = auth.uid(), false) OR v_role IN ('admin', 'manager'),
    p.fullname,
    false
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.id = c.assigned_to
  WHERE c.mobile = v_mobile
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.find_customer_by_mobile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_mobile(TEXT) TO authenticated;

COMMIT;

-- ── Existing leads that already use a team member's number ───────────────────
-- Review these in the admin console: correct the mobile or delete the lead.
SELECT c.customer_id, c.shop_name, c.mobile, c.created_at,
       owner.fullname AS lead_agent,
       team.fullname  AS number_belongs_to
  FROM public.customers c
  JOIN public.profiles team
    ON team.is_approved
   AND public.normalize_mobile(team.mobile) = public.normalize_mobile(c.mobile)
  LEFT JOIN public.profiles owner ON owner.id = c.assigned_to
 ORDER BY c.created_at DESC;
