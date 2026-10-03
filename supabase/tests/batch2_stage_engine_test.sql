-- ============================================================
-- Batch 2 stage-engine checks — run in the Supabase SQL Editor AFTER
-- migrations 007 AND 008.
--
-- Any failed check stops with "FAIL n: ...". If all pass, the last statement
-- deliberately stops with "ALL 12 BATCH 2 CHECKS PASSED" (expected: it rolls
-- back the run; test rows are also deleted just before it).
--
-- Needs at least one approved sales user.
-- ============================================================

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
DELETE FROM public.customers WHERE mobile IN ('0000000011', '0000000012', '0000000013');

DROP TABLE IF EXISTS t_users;
CREATE TEMP TABLE t_users AS
SELECT (SELECT id FROM public.profiles WHERE role = 'sales' AND is_approved ORDER BY created_at LIMIT 1) AS sales_id;

DO $$ BEGIN
  IF (SELECT sales_id IS NULL FROM t_users) THEN
    RAISE EXCEPTION 'SETUP: need one approved sales user';
  END IF;
  IF (SELECT COUNT(*) FROM public.stage_defs WHERE is_live) <> 5 THEN
    RAISE EXCEPTION 'FAIL 1: expected 5 live stages, found %', (SELECT COUNT(*) FROM public.stage_defs WHERE is_live);
  END IF;
  IF (SELECT min_photos FROM public.stage_defs WHERE key = 'visited') <> 3 THEN
    RAISE EXCEPTION 'FAIL 1: visited should need 3 photos (did 008 run?)';
  END IF;
END $$;

-- A lead that is closed (Lost), to check closed leads do not advance.
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to, status)
SELECT '00000000-0000-4000-8000-0000000000b3', 'TEST lost lead', '0000000013', sales_id, 'lost' FROM t_users;

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', sales_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE
  v_id    UUID;
  v_stage TEXT;
  v_rank  INT;
  v_hist  INT;
  v_skip  TEXT[];
  v_by    UUID;
BEGIN
  -- 2. A new lead starts at 'new', rank 0
  INSERT INTO public.customers (shop_name, mobile) VALUES ('TEST stage lead', '0000000011')
  RETURNING customer_id, stage, stage_rank INTO v_id, v_stage, v_rank;
  IF v_stage <> 'new' OR v_rank <> 0 THEN
    RAISE EXCEPTION 'FAIL 2: new lead is %/% not new/0', v_stage, v_rank;
  END IF;

  -- 3. lead_created keeps it at 'new'; event records its creator
  INSERT INTO public.events (customer_id, event_type, data) VALUES (v_id, 'lead_created', '{}')
  RETURNING created_by INTO v_by;
  IF v_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FAIL 3: events.created_by is % not the caller', v_by;
  END IF;

  -- 4. A visit with 2 photos is refused, and the event is not saved
  BEGIN
    INSERT INTO public.events (customer_id, event_type, data)
    VALUES (v_id, 'visit_done', '{"photoUrls": ["a", "b"]}');
    RAISE EXCEPTION 'FAIL 4: visit with 2 photos was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.events WHERE customer_id = v_id AND event_type = 'visit_done') THEN
    RAISE EXCEPTION 'FAIL 4: refused visit event was still saved';
  END IF;

  -- 5. A visit with 3 photos moves the lead to visited, with one history row
  INSERT INTO public.events (customer_id, event_type, data)
  VALUES (v_id, 'visit_done', '{"photoUrls": ["a", "b", "c"]}');
  SELECT stage, stage_rank INTO v_stage, v_rank FROM public.customers WHERE customer_id = v_id;
  SELECT COUNT(*) INTO v_hist FROM public.stage_history WHERE customer_id = v_id AND to_stage = 'visited';
  IF v_stage <> 'visited' OR v_rank <> 10 OR v_hist <> 1 THEN
    RAISE EXCEPTION 'FAIL 5: after visit got %/% with % history rows', v_stage, v_rank, v_hist;
  END IF;

  -- 6. Jumping to ROI records the skipped step
  INSERT INTO public.events (customer_id, event_type, data) VALUES (v_id, 'roi_shown', '{}');
  SELECT skipped_steps INTO v_skip FROM public.stage_history
   WHERE customer_id = v_id AND to_stage = 'roi_shown';
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = v_id;
  IF v_stage <> 'roi_shown' OR v_skip IS DISTINCT FROM ARRAY['pain_identified'] THEN
    RAISE EXCEPTION 'FAIL 6: got % with skipped %', v_stage, v_skip;
  END IF;

  -- 7. A lower step afterwards is saved but never moves the stage back
  INSERT INTO public.events (customer_id, event_type, data) VALUES (v_id, 'pain_identified', '{}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = v_id;
  SELECT COUNT(*) INTO v_hist FROM public.stage_history WHERE customer_id = v_id AND to_stage = 'pain_identified';
  IF v_stage <> 'roi_shown' OR v_hist <> 0 THEN
    RAISE EXCEPTION 'FAIL 7: lower step moved stage to % (history rows %)', v_stage, v_hist;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE customer_id = v_id AND event_type = 'pain_identified') THEN
    RAISE EXCEPTION 'FAIL 7: lower-step event was not saved';
  END IF;

  -- 8. The app cannot write stage directly
  BEGIN
    UPDATE public.customers SET stage = 'login_started' WHERE customer_id = v_id;
    RAISE EXCEPTION 'FAIL 8: direct stage UPDATE allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 9. ...nor set it on insert
  BEGIN
    INSERT INTO public.customers (shop_name, mobile, stage) VALUES ('TEST cheat', '0000000012', 'login_started');
    RAISE EXCEPTION 'FAIL 9: insert with stage allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 10. Normal field edits still work
  UPDATE public.customers SET landmark = 'Johri Bazar' WHERE customer_id = v_id;

  -- 11. A closed (Lost) lead does not advance; the event is still kept
  INSERT INTO public.events (customer_id, event_type, data)
  VALUES ('00000000-0000-4000-8000-0000000000b3', 'login_started', '{}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = '00000000-0000-4000-8000-0000000000b3';
  IF v_stage <> 'new' THEN
    RAISE EXCEPTION 'FAIL 11: lost lead advanced to %', v_stage;
  END IF;
END $$;

RESET ROLE;

-- 12. Forward-only guard holds even for a direct write by a trusted role
DO $$
DECLARE v_stage TEXT;
BEGIN
  UPDATE public.customers SET stage = 'visited' WHERE mobile = '0000000011';
  SELECT stage INTO v_stage FROM public.customers WHERE mobile = '0000000011';
  IF v_stage <> 'roi_shown' THEN
    RAISE EXCEPTION 'FAIL 12: guard let stage move back to %', v_stage;
  END IF;
END $$;

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.customers WHERE mobile IN ('0000000011', '0000000012', '0000000013');
DROP TABLE t_users;

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 12 BATCH 2 CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
