-- ============================================================
-- Batch 5 checks (Interested + Qualified stages) — run in the Supabase SQL
-- Editor AFTER migration 015.
--
-- Any failed check stops with "FAIL n: ...". If all pass, the last statement
-- deliberately stops with "ALL 8 BATCH 5 CHECKS PASSED" (expected: it rolls
-- back the run; test rows are also deleted just before it).
--
-- Needs one approved sales user and one approved admin.
-- ============================================================

-- ── Fixtures (as postgres: triggers trust requests without a JWT) ────────────
DELETE FROM public.customers WHERE mobile IN ('0000000051', '0000000052');

DROP TABLE IF EXISTS t_users;
CREATE TEMP TABLE t_users AS
SELECT
  (SELECT id FROM public.profiles WHERE role = 'sales' AND is_approved ORDER BY created_at LIMIT 1) AS sales_id,
  (SELECT id FROM public.profiles WHERE role = 'admin' AND is_approved ORDER BY created_at LIMIT 1) AS admin_id;

DO $$ BEGIN
  IF (SELECT sales_id IS NULL OR admin_id IS NULL FROM t_users) THEN
    RAISE EXCEPTION 'SETUP: need one approved sales user and one approved admin';
  END IF;

  -- 1. The live ladder
  IF (SELECT COUNT(*) FROM public.stage_defs WHERE is_live) <> 7 THEN
    RAISE EXCEPTION 'FAIL 1: expected 7 live stages, found %', (SELECT COUNT(*) FROM public.stage_defs WHERE is_live);
  END IF;
  IF (SELECT rank FROM public.stage_defs WHERE key = 'interested') <> 55
     OR (SELECT rank FROM public.stage_defs WHERE key = 'qualified') <> 60
     OR (SELECT min_role FROM public.stage_defs WHERE key = 'qualified') <> 'manager' THEN
    RAISE EXCEPTION 'FAIL 1: interested/qualified ranks or roles are wrong';
  END IF;
END $$;

INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000e1', 'TEST interested lead', '0000000051', sales_id FROM t_users;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000e2', 'TEST dormant lead',    '0000000052', sales_id FROM t_users;

INSERT INTO public.events (customer_id, event_type, data) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'pain_identified', '{}'),
  ('00000000-0000-4000-8000-0000000000e2', 'pain_identified', '{}'),
  ('00000000-0000-4000-8000-0000000000e2', 'status_changed',  '{"status": "dormant", "reason": "test fixture"}');

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', sales_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE
  v_stage  TEXT;
  v_status TEXT;
  lead     CONSTANT UUID := '00000000-0000-4000-8000-0000000000e1';
  dormant  CONSTANT UUID := '00000000-0000-4000-8000-0000000000e2';
BEGIN
  -- 2. "Soch Raha" is recorded but does not move the stage
  INSERT INTO public.events (customer_id, event_type, data) VALUES (lead, 'customer_response', '{"response": "thinking"}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = lead;
  IF v_stage <> 'pain_identified' THEN
    RAISE EXCEPTION 'FAIL 2: thinking moved the stage to %', v_stage;
  END IF;

  -- 3. "Interested" moves the lead to Interested
  INSERT INTO public.events (customer_id, event_type, data) VALUES (lead, 'customer_response', '{"response": "interested"}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = lead;
  IF v_stage <> 'interested' THEN
    RAISE EXCEPTION 'FAIL 3: interested left the stage at %', v_stage;
  END IF;

  -- 4. An agent cannot qualify a lead
  BEGIN
    INSERT INTO public.events (customer_id, event_type, data) VALUES (lead, 'lead_qualified', '{}');
    RAISE EXCEPTION 'FAIL 4: sales was allowed to qualify a lead';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. A dormant lead that says Interested is reactivated AND advances
  INSERT INTO public.events (customer_id, event_type, data) VALUES (dormant, 'customer_response', '{"response": "interested"}');
  SELECT stage, status INTO v_stage, v_status FROM public.customers WHERE customer_id = dormant;
  IF v_stage <> 'interested' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'FAIL 5: dormant + interested ended at %/% (want interested/active)', v_stage, v_status;
  END IF;

  -- 6. "Nahi" after Interested moves status to nurture, never the stage back
  INSERT INTO public.events (customer_id, event_type, data) VALUES (dormant, 'customer_response', '{"response": "not_interested"}');
  SELECT stage, status INTO v_stage, v_status FROM public.customers WHERE customer_id = dormant;
  IF v_stage <> 'interested' OR v_status <> 'nurture' THEN
    RAISE EXCEPTION 'FAIL 6: Nahi ended at %/% (want interested/nurture)', v_stage, v_status;
  END IF;
END $$;

RESET ROLE;

-- ── As the admin ─────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', admin_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE
  v_stage TEXT;
  v_hist  INT;
  lead    CONSTANT UUID := '00000000-0000-4000-8000-0000000000e1';
BEGIN
  -- 7. A manager/admin qualifies the lead
  INSERT INTO public.events (customer_id, event_type, data) VALUES (lead, 'lead_qualified', '{"note": "test"}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = lead;
  SELECT COUNT(*) INTO v_hist FROM public.stage_history WHERE customer_id = lead AND to_stage = 'qualified';
  IF v_stage <> 'qualified' OR v_hist <> 1 THEN
    RAISE EXCEPTION 'FAIL 7: qualify ended at % with % history rows', v_stage, v_hist;
  END IF;

  -- 8. A later Interested response never moves a qualified lead back
  INSERT INTO public.events (customer_id, event_type, data) VALUES (lead, 'customer_response', '{"response": "interested"}');
  SELECT stage INTO v_stage FROM public.customers WHERE customer_id = lead;
  IF v_stage <> 'qualified' THEN
    RAISE EXCEPTION 'FAIL 8: qualified lead moved to %', v_stage;
  END IF;
END $$;

RESET ROLE;

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.customers WHERE mobile IN ('0000000051', '0000000052');
DROP TABLE t_users;

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 8 BATCH 5 CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
