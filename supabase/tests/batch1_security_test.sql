-- ============================================================
-- Batch 1 security checks — run in the Supabase SQL Editor AFTER
-- migrations 001-006.
--
-- How to read the result:
--   • Any failed check stops the script with an error "FAIL n: ...".
--   • If every check passes, the LAST statement deliberately stops with
--     "ALL 16 BATCH 1 CHECKS PASSED". That error is expected: it makes the
--     editor roll back, and the test rows are also deleted just before it.
--
-- Needs at least one approved sales user and one approved admin.
-- ============================================================

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
-- Leftovers from an interrupted earlier run.
DELETE FROM public.admin_audit_log WHERE entity_id::text LIKE '00000000-0000-4000-8000-0000000000a%';
DELETE FROM public.customers WHERE mobile IN ('0000000001', '0000000002', '0000000003', '0000000004');

DROP TABLE IF EXISTS t_users;
CREATE TEMP TABLE t_users AS
SELECT
  (SELECT id FROM public.profiles WHERE role = 'sales' AND is_approved ORDER BY created_at LIMIT 1) AS sales_id,
  (SELECT id FROM public.profiles WHERE role = 'admin' AND is_approved ORDER BY created_at LIMIT 1) AS admin_id;

DO $$ BEGIN
  IF (SELECT sales_id IS NULL OR admin_id IS NULL FROM t_users) THEN
    RAISE EXCEPTION 'SETUP: need one approved sales user and one approved admin';
  END IF;
END $$;

-- A colleague's (admin's) old lead, and the sales user's new and old leads.
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to, created_at)
SELECT '00000000-0000-4000-8000-0000000000a1', 'TEST colleague lead', '0000000001', admin_id, NOW() - INTERVAL '3 days' FROM t_users;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to, created_at)
SELECT '00000000-0000-4000-8000-0000000000a2', 'TEST own new lead',   '0000000002', sales_id, NOW() FROM t_users;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to, created_at)
SELECT '00000000-0000-4000-8000-0000000000a3', 'TEST own old lead',   '0000000003', sales_id, NOW() - INTERVAL '3 days' FROM t_users;

-- ── As anon ──────────────────────────────────────────────────────────────────
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.customers LIMIT 1;
    RAISE EXCEPTION 'FAIL 1: anon can read customers';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 1
  END;
END $$;
RESET ROLE;

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', sales_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL 2: sales user promoted themselves';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 2
  END;

  BEGIN
    UPDATE public.profiles SET mobile = '0000000009' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL 3: sales user changed their login mobile';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 3
  END;

  -- PASS 4: a harmless self-edit still works (raises if the trigger is too strict).
  UPDATE public.profiles SET fullname = fullname WHERE id = auth.uid();
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.find_customer_by_mobile('0000000001');
  IF r.customer_id IS NOT NULL OR r.can_edit OR r.owner_name IS NULL THEN
    RAISE EXCEPTION 'FAIL 5: colleague lead lookup leaked its id or hid the owner: %', r;
  END IF;

  SELECT * INTO r FROM public.find_customer_by_mobile('0000000002');
  IF r.customer_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000a2'::uuid OR NOT r.is_mine THEN
    RAISE EXCEPTION 'FAIL 6: own lead lookup wrong: %', r;
  END IF;

  IF EXISTS (SELECT 1 FROM public.find_customer_by_mobile('0000009999')) THEN
    RAISE EXCEPTION 'FAIL 7: unknown number returned a row';
  END IF;
END $$;

DO $$
DECLARE v_owner UUID;
BEGIN
  INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST quick create', '0000000004')
  RETURNING assigned_to INTO v_owner;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FAIL 8: new lead owner is %, not the creator', v_owner;
  END IF;

  BEGIN
    DELETE FROM public.customers WHERE customer_id = '00000000-0000-4000-8000-0000000000a2';
    RAISE EXCEPTION 'FAIL 9: direct DELETE on customers allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 9
  END;

  BEGIN
    PERFORM public.delete_customer('00000000-0000-4000-8000-0000000000a1');
    RAISE EXCEPTION 'FAIL 10: sales deleted a colleague''s lead';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 10
  END;

  BEGIN
    PERFORM public.delete_customer('00000000-0000-4000-8000-0000000000a3');
    RAISE EXCEPTION 'FAIL 11: sales deleted their own 3-day-old lead';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 11
  END;

  PERFORM public.delete_customer('00000000-0000-4000-8000-0000000000a2');
  IF EXISTS (SELECT 1 FROM public.customers WHERE customer_id = '00000000-0000-4000-8000-0000000000a2') THEN
    RAISE EXCEPTION 'FAIL 12: own new lead still exists after delete';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_audit_log) THEN
    RAISE EXCEPTION 'FAIL 13: sales user can read the audit log';
  END IF;
END $$;

RESET ROLE;

-- ── As the admin ─────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', admin_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'sales' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL 14: admin demoted themselves';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- PASS 14
  END;

  -- PASS 15: admin may delete any lead.
  PERFORM public.delete_customer('00000000-0000-4000-8000-0000000000a3');

  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log
                  WHERE entity_id = '00000000-0000-4000-8000-0000000000a3'
                    AND action = 'customer_deleted'
                    AND snapshot->>'shop_name' = 'TEST own old lead') THEN
    RAISE EXCEPTION 'FAIL 16: delete was not audited with a snapshot';
  END IF;
END $$;

RESET ROLE;

-- ── Not automatable here ────────────────────────────────────────────────────
-- Signup forcing sales/unapproved needs a real auth user (profiles.id has an
-- FK to auth.users). Check by hand: sign up a test number in the app, then
--   SELECT role, is_approved FROM profiles WHERE mobile = '<that number>';
-- must return sales / false.

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.admin_audit_log WHERE entity_id::text LIKE '00000000-0000-4000-8000-0000000000a%';
DELETE FROM public.customers WHERE mobile IN ('0000000001', '0000000002', '0000000003', '0000000004');
DROP TABLE t_users;

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 16 BATCH 1 CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
