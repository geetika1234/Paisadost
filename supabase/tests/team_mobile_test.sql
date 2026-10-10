-- ============================================================
-- Team-mobile block checks — run in the Supabase SQL Editor AFTER 013.
--
-- Any failed check stops with "FAIL n: ...". If all pass, the last statement
-- deliberately stops with "ALL 9 TEAM MOBILE CHECKS PASSED" (expected: it
-- rolls back the run; test rows are also deleted just before it).
--
-- Needs one approved sales user and one approved admin, each with a mobile.
-- ============================================================

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
DELETE FROM public.customers WHERE shop_name LIKE 'TEST team-mobile%';

-- Pass the team numbers into the role-switched blocks via session settings
-- (temp tables are not readable once we SET ROLE authenticated).
SELECT set_config('test.sales_id',     id::text, false),
       set_config('test.sales_mobile', mobile,   false)
  FROM public.profiles WHERE role = 'sales' AND is_approved ORDER BY created_at LIMIT 1;
SELECT set_config('test.admin_mobile', mobile, false)
  FROM public.profiles WHERE role = 'admin' AND is_approved ORDER BY created_at LIMIT 1;

DO $$ BEGIN
  IF COALESCE(current_setting('test.sales_mobile', true), '') = ''
  OR COALESCE(current_setting('test.admin_mobile', true), '') = '' THEN
    RAISE EXCEPTION 'SETUP: need an approved sales user and an approved admin with mobiles';
  END IF;
END $$;

-- An older lead that already carries the sales user's number (created with the
-- guard switched off, to stand for data from before 013).
ALTER TABLE public.customers DISABLE TRIGGER customers_guard_mobile;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
VALUES ('00000000-0000-4000-8000-0000000000e1', 'TEST team-mobile legacy',
        current_setting('test.sales_mobile'), current_setting('test.sales_id')::uuid)
ON CONFLICT (mobile) DO NOTHING;   -- a real lead may already have this number (the bug being fixed)
ALTER TABLE public.customers ENABLE TRIGGER customers_guard_mobile;

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.sales_id'), 'role', 'authenticated')::text, false);
SET ROLE authenticated;

DO $$
DECLARE
  own   TEXT := current_setting('test.sales_mobile');
  other TEXT := current_setting('test.admin_mobile');
  r     RECORD;
  v_id  UUID;
BEGIN
  -- 1. Own number
  BEGIN
    INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST team-mobile 1', own);
    RAISE EXCEPTION 'FAIL 1: lead created with the agent''s own number';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 2. A colleague's number
  BEGIN
    INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST team-mobile 2', other);
    RAISE EXCEPTION 'FAIL 2: lead created with a colleague''s number';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. Same number written as +91 with spaces
  BEGIN
    INSERT INTO public.customers (shop_name, mobile)
    VALUES ('TEST team-mobile 3', '+91 ' || substr(own, 1, 5) || ' ' || substr(own, 6));
    RAISE EXCEPTION 'FAIL 3: +91 / spaced form of a team number slipped through';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 4. Same number with a leading 0
  BEGIN
    INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST team-mobile 4', '0' || own);
    RAISE EXCEPTION 'FAIL 4: 0-prefixed team number slipped through';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 5. A normal customer number still works
  INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST team-mobile 5', '0000000041')
  RETURNING customer_id INTO v_id;

  -- 6. Changing a lead's mobile to a team number is refused
  BEGIN
    UPDATE public.customers SET mobile = own WHERE customer_id = v_id;
    RAISE EXCEPTION 'FAIL 6: lead mobile changed to a team number';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 7. An older lead that already has a team number can still be edited otherwise
  UPDATE public.customers SET landmark = 'Johri Bazar'
   WHERE customer_id = '00000000-0000-4000-8000-0000000000e1';

  -- 8. The lookup reports a team number and nothing about any lead
  SELECT * INTO r FROM public.find_customer_by_mobile(own);
  IF NOT r.is_team OR r.customer_id IS NOT NULL OR r.owner_name IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 8: team lookup wrong: %', r;
  END IF;
  SELECT * INTO r FROM public.find_customer_by_mobile('0000000041');
  IF r.is_team OR r.customer_id IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'FAIL 8: customer lookup wrong: %', r;
  END IF;

  -- 9. The yes/no helper is not callable from the app
  BEGIN
    PERFORM public.is_team_mobile(own);
    RAISE EXCEPTION 'FAIL 9: app users can probe team numbers directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.customers WHERE shop_name LIKE 'TEST team-mobile%';

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 9 TEAM MOBILE CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
