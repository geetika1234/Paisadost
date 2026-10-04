-- ============================================================
-- Batch 4 checks (admin console data + private photos) — run in the
-- Supabase SQL Editor AFTER migrations 011 AND 012.
--
-- Any failed check stops with "FAIL n: ...". If all pass, the last statement
-- deliberately stops with "ALL 10 BATCH 4 CHECKS PASSED" (expected: it rolls
-- back the run; test rows are also deleted just before it).
--
-- Needs one approved sales user and one approved admin.
-- ============================================================

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
DELETE FROM public.admin_audit_log WHERE action = 'test_batch_four';
DELETE FROM public.customers WHERE mobile IN ('0000000031', '0000000032');

DROP TABLE IF EXISTS t_users;
CREATE TEMP TABLE t_users AS
SELECT
  (SELECT id FROM public.profiles WHERE role = 'sales' AND is_approved ORDER BY created_at LIMIT 1) AS sales_id,
  (SELECT id FROM public.profiles WHERE role = 'admin' AND is_approved ORDER BY created_at LIMIT 1) AS admin_id;

DO $$ BEGIN
  IF (SELECT sales_id IS NULL OR admin_id IS NULL FROM t_users) THEN
    RAISE EXCEPTION 'SETUP: need one approved sales user and one approved admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'visit-photos' AND NOT public) THEN
    RAISE EXCEPTION 'FAIL 1: private visit-photos bucket missing (did 012 run?)';
  END IF;
END $$;

INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000d1', 'TEST own lead',       '0000000031', sales_id FROM t_users;
INSERT INTO public.customers (customer_id, shop_name, mobile, assigned_to)
SELECT '00000000-0000-4000-8000-0000000000d2', 'TEST colleague lead', '0000000032', admin_id FROM t_users;
INSERT INTO public.reminders (customer_id, due_at, note)
VALUES ('00000000-0000-4000-8000-0000000000d1', NOW() - INTERVAL '1 day', 'overdue test');

-- ── As the sales user ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', sales_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE r RECORD;
BEGIN
  -- 2. The view respects RLS (security_invoker): no colleague rows
  IF EXISTS (SELECT 1 FROM public.lead_summary WHERE mobile = '0000000032') THEN
    RAISE EXCEPTION 'FAIL 2: lead_summary shows a colleague''s lead to sales';
  END IF;

  -- 3. Own row has the computed columns
  SELECT * INTO r FROM public.lead_summary WHERE mobile = '0000000031';
  IF r.customer_id IS NULL OR NOT r.followup_overdue OR r.last_activity_at IS NULL THEN
    RAISE EXCEPTION 'FAIL 3: own lead summary wrong: %', r;
  END IF;

  -- 4. Today summary is admin/manager only
  BEGIN
    PERFORM public.admin_today_summary();
    RAISE EXCEPTION 'FAIL 4: sales could read the admin summary';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. Audit writes are admin/manager only
  BEGIN
    PERFORM public.log_admin_action('test_batch_four', '{}'::jsonb);
    RAISE EXCEPTION 'FAIL 5: sales wrote to the audit log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 6. Photo paths: own lead yes, colleague no, junk no
  IF NOT public.can_access_photo_path('00000000-0000-4000-8000-0000000000d1/a.jpg') THEN
    RAISE EXCEPTION 'FAIL 6: sales cannot reach photos of their own lead';
  END IF;
  IF public.can_access_photo_path('00000000-0000-4000-8000-0000000000d2/a.jpg') THEN
    RAISE EXCEPTION 'FAIL 6: sales can reach a colleague''s photos';
  END IF;
  IF public.can_access_photo_path('../etc/passwd') OR public.can_access_photo_path('a.jpg') THEN
    RAISE EXCEPTION 'FAIL 6: malformed photo path allowed';
  END IF;
END $$;

RESET ROLE;

-- ── As the admin ─────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', admin_id, 'role', 'authenticated')::text, false) FROM t_users;
SET ROLE authenticated;

DO $$
DECLARE s JSONB;
BEGIN
  -- 7. Admin sees every lead through the view
  IF (SELECT COUNT(*) FROM public.lead_summary WHERE mobile IN ('0000000031', '0000000032')) <> 2 THEN
    RAISE EXCEPTION 'FAIL 7: admin does not see every lead in lead_summary';
  END IF;

  -- 8. Today summary has every section the page reads
  s := public.admin_today_summary();
  IF NOT (s ? 'pending_users' AND s ? 'unowned_leads' AND s ? 'dormant_candidates'
          AND s ? 'overdue_by_agent' AND s ? 'kpis' AND s ? 'funnel' AND s ? 'agents') THEN
    RAISE EXCEPTION 'FAIL 8: summary missing sections: %', s;
  END IF;
  IF jsonb_array_length(s -> 'funnel') <> 5 THEN
    RAISE EXCEPTION 'FAIL 8: funnel should have 5 stages, has %', jsonb_array_length(s -> 'funnel');
  END IF;

  -- 9. Overdue follow-up is counted against the owning agent.
  -- (t_users belongs to postgres and is not readable here; admins can read
  -- profiles, so pick the sales user with the same rule as the fixtures.)
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'overdue_by_agent') a
                  WHERE (a ->> 'agent_id')::uuid = (SELECT id FROM public.profiles
                                                     WHERE role = 'sales' AND is_approved
                                                     ORDER BY created_at LIMIT 1)
                    AND (a ->> 'count')::int >= 1) THEN
    RAISE EXCEPTION 'FAIL 9: overdue follow-up not attributed to its agent';
  END IF;

  -- 10. Audit write works for admins and rejects junk action names
  PERFORM public.log_admin_action('test_batch_four', '{"n": 1}'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'test_batch_four') THEN
    RAISE EXCEPTION 'FAIL 10: admin action not logged';
  END IF;
  BEGIN
    PERFORM public.log_admin_action('Drop Table; --', '{}'::jsonb);
    RAISE EXCEPTION 'FAIL 10: junk action name accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

RESET ROLE;

-- ── Clean up and report ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '', false);
DELETE FROM public.admin_audit_log WHERE action = 'test_batch_four';
DELETE FROM public.customers WHERE mobile IN ('0000000031', '0000000032');
DROP TABLE t_users;

DO $$ BEGIN
  RAISE EXCEPTION 'ALL 10 BATCH 4 CHECKS PASSED (this error is expected: it rolls back the test run)';
END $$;
