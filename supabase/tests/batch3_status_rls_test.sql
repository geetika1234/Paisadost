-- ============================================================
-- Batch 3 checks (status rules + per-agent access) — run in the Supabase
-- SQL Editor AFTER migrations 009 AND 010.
--
-- Any failed check stops with "FAIL n: ...". If all pass, the last statement
-- deliberately stops with "ALL 17 BATCH 3 CHECKS PASSED" (expected: it rolls
-- back the run; test rows are also deleted just before it).
--
-- Needs one approved sales user and one approved admin. The "colleague" lead
-- below belongs to the admin, which a sales user must not see.
-- ============================================================

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
DELETE FROM public.customers WHERE mobile IN ('0000000021', '0000000022', '0000000023');

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

INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000c1', 'TEST own lead',       '0000000021', sales_id FROM t_users;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000c2', 'TEST colleague lead', '0000000022', admin_id FROM t_users;

INSERT INTO public.events (customer_id, event_type, data)
VALUES ('00000000-0000-4000-8000-0000000000c2', 'note_added', '{"text": "colleague note"}');
INSERT INTO public.reminders (customer_id, due_at, note)
VALUES ('00000000-0000-4000-8000-0000000000c2', NOW() + INTERVAL '1 day', 'colleague reminder');

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', sales_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE
  v_n      INT;
  v_status TEXT;
  own      CONSTANT UUID := '00000000-0000-4000-8000-0000000000c1';
  other    CONSTANT UUID := '00000000-0000-4000-8000-0000000000c2';
BEGIN
  -- Access isolation
  IF EXISTS (SELECT 1 FROM public.customers WHERE customer_id = other) THEN
    RAISE EXCEPTION 'FAIL 1: sales can see a colleague''s lead';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE customer_id = other) THEN
    RAISE EXCEPTION 'FAIL 2: sales can see a colleague''s events';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reminders WHERE customer_id = other) THEN
    RAISE EXCEPTION 'FAIL 3: sales can see a colleague''s follow-ups';
  END IF;

  BEGIN
    INSERT INTO public.events (customer_id, event_type, data) VALUES (other, 'note_added', '{}');
    RAISE EXCEPTION 'FAIL 4: sales wrote an event on a colleague''s lead';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.customers SET landmark = 'hijack' WHERE customer_id = other;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL 5: sales updated a colleague''s lead'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_id = own) THEN
    RAISE EXCEPTION 'FAIL 6: sales cannot see their own lead';
  END IF;

  BEGIN
    UPDATE public.customers SET assigned_to = (SELECT id FROM public.profiles WHERE role = 'admin' AND is_approved LIMIT 1)
     WHERE customer_id = own;
    RAISE EXCEPTION 'FAIL 7: sales handed their lead to someone else';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Automatic status rules from the response dropdown
  INSERT INTO public.events (customer_id, event_type, data) VALUES (own, 'customer_response', '{"response": "not_interested"}');
  SELECT status INTO v_status FROM public.customers WHERE customer_id = own;
  IF v_status <> 'nurture' THEN RAISE EXCEPTION 'FAIL 8: "Nahi" gave % not nurture', v_status; END IF;

  INSERT INTO public.events (customer_id, event_type, data) VALUES (own, 'customer_response', '{"response": "interested"}');
  SELECT status INTO v_status FROM public.customers WHERE customer_id = own;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL 9: "Interested" gave % not active', v_status; END IF;

  -- Agent closing rules
  BEGIN
    INSERT INTO public.events (customer_id, event_type, data) VALUES (own, 'status_changed', '{"status": "lost"}');
    RAISE EXCEPTION 'FAIL 10: status change without a reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (customer_id, event_type, data)
    VALUES (own, 'status_changed', '{"status": "rejected", "reason": "x"}');
    RAISE EXCEPTION 'FAIL 11: sales set Rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  INSERT INTO public.events (customer_id, event_type, data)
  VALUES (own, 'status_changed', '{"status": "lost", "reason": "Dukaan band ho gayi"}');
  SELECT status INTO v_status FROM public.customers WHERE customer_id = own;
  IF v_status <> 'lost' THEN RAISE EXCEPTION 'FAIL 12: close as lost gave %', v_status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stage_history
                  WHERE customer_id = own AND to_status = 'lost' AND reason = 'Dukaan band ho gayi') THEN
    RAISE EXCEPTION 'FAIL 12: closing was not recorded in history';
  END IF;

  BEGIN
    INSERT INTO public.events (customer_id, event_type, data)
    VALUES (own, 'status_changed', '{"status": "active", "reason": "wapas"}');
    RAISE EXCEPTION 'FAIL 13: sales reopened a closed lead';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- "Interested" must not silently reopen a Lost lead
  INSERT INTO public.events (customer_id, event_type, data) VALUES (own, 'customer_response', '{"response": "interested"}');
  SELECT status INTO v_status FROM public.customers WHERE customer_id = own;
  IF v_status <> 'lost' THEN RAISE EXCEPTION 'FAIL 14: "Interested" reopened a lost lead (%)', v_status; END IF;
END $$;

RESET ROLE;

-- ── As the admin ─────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', admin_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE v_status TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM public.customers WHERE mobile IN ('0000000021', '0000000022')) <> 2 THEN
    RAISE EXCEPTION 'FAIL 15: admin cannot see every lead';
  END IF;

  INSERT INTO public.events (customer_id, event_type, data)
  VALUES ('00000000-0000-4000-8000-0000000000c1', 'status_changed', '{"status": "active", "reason": "Customer wapas aaya"}');
  SELECT status INTO v_status FROM public.customers WHERE customer_id = '00000000-0000-4000-8000-0000000000c1';
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL 16: admin reactivation gave %', v_status; END IF;

  BEGIN
    INSERT INTO public.events (customer_id, event_type, data)
    VALUES ('00000000-0000-4000-8000-0000000000c1', 'status_changed', '{"status": "rejected", "reason": "Lender ne mana kiya"}');
    RAISE EXCEPTION 'FAIL 17: Rejected allowed before Login Done';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

RESET ROLE;

-- ── Unapproved users see nothing (only if one exists) ────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, false)
  FROM public.profiles WHERE NOT is_approved LIMIT 1;
SET ROLE authenticated;
DO $$ BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.am_i_approved()
     AND EXISTS (SELECT 1 FROM public.customers) THEN
    RAISE EXCEPTION 'FAIL (extra): an unapproved user can see leads';
  END IF;
END $$;
RESET ROLE;

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.customers WHERE mobile IN ('0000000021', '0000000022', '0000000023');
DROP TABLE t_users;

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 17 BATCH 3 CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
