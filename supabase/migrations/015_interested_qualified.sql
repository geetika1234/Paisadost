-- ============================================================
-- 015 — Interested and Qualified stages
--
-- Run this BEFORE deploying the app that shows the qualification form.
-- Safe while the current app is live: it only adds stages and changes which
-- order the two event triggers run in.
--
-- Ladder after this migration:
--   new 0 → visited 10 → pain_identified 20 → roi_shown 50
--   → interested 55 → qualified 60 → login_started 80
--
--   interested  = a customer_response event whose data is {"response": "interested"}
--                 (Soch Raha / Nahi responses never move the stage)
--   qualified   = a lead_qualified event; only a manager or admin may record it
--                 (the agent submits the qualification answers, the manager decides)
--
-- Trigger order: Postgres runs same-timing triggers by name. Status now runs
-- before stage, so a dormant lead that says "Interested" is reactivated first
-- and then advances to Interested on that same event.
-- ============================================================

BEGIN;

-- ── 1. A stage can require specific event data ──────────────────────────────
ALTER TABLE public.stage_defs ADD COLUMN IF NOT EXISTS match_data JSONB;

INSERT INTO public.stage_defs (key, rank, event_type, min_role, min_photos, is_live, match_data) VALUES
  ('interested', 55, 'customer_response', 'sales',   0, true, '{"response": "interested"}'),
  ('qualified',  60, 'lead_qualified',    'manager', 0, true, NULL)
ON CONFLICT (key) DO UPDATE
  SET rank = EXCLUDED.rank, event_type = EXCLUDED.event_type, min_role = EXCLUDED.min_role,
      is_live = EXCLUDED.is_live, match_data = EXCLUDED.match_data;

-- ── 2. Stage engine: same rules as 007, plus the match_data check ──────────
CREATE OR REPLACE FUNCTION public.apply_stage_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.stage_defs%ROWTYPE;
  c          public.customers%ROWTYPE;
  v_role     TEXT;
  v_photos   INTEGER;
  v_skipped  TEXT[];
  role_level CONSTANT JSONB := '{"sales": 1, "manager": 2, "admin": 3}';
BEGIN
  SELECT * INTO d FROM public.stage_defs
   WHERE event_type = NEW.event_type AND is_live
     AND (match_data IS NULL OR COALESCE(NEW.data, '{}'::jsonb) @> match_data);
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Requests without an end-user JWT (SQL editor, service role) are trusted.
  IF auth.uid() IS NOT NULL THEN
    v_role := public.get_my_role();
    IF NOT public.am_i_approved()
       OR COALESCE((role_level ->> v_role)::INT, 0) < (role_level ->> d.min_role)::INT THEN
      RAISE EXCEPTION 'stage_role_denied: % needs %', d.key, d.min_role USING ERRCODE = '42501';
    END IF;
  END IF;

  IF d.min_photos > 0 THEN
    v_photos := CASE WHEN jsonb_typeof(NEW.data -> 'photoUrls') = 'array'
                     THEN jsonb_array_length(NEW.data -> 'photoUrls') ELSE 0 END;
    IF v_photos < d.min_photos THEN
      RAISE EXCEPTION 'stage_evidence_missing: % needs % photos, got %', d.key, d.min_photos, v_photos
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Serialise concurrent events for the same lead.
  SELECT * INTO c FROM public.customers WHERE customer_id = NEW.customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF c.status IN ('not_qualified', 'lost', 'rejected', 'dormant') THEN
    RETURN NEW;       -- closed leads must be reactivated before they can advance
  END IF;

  IF d.rank <= c.stage_rank THEN
    RETURN NEW;       -- forward-only: repeat or lower step is recorded, stage unchanged
  END IF;

  SELECT array_agg(key ORDER BY rank) INTO v_skipped
    FROM public.stage_defs
   WHERE is_live AND rank > c.stage_rank AND rank < d.rank;

  UPDATE public.customers
     SET stage = d.key, stage_rank = d.rank
   WHERE customer_id = NEW.customer_id;

  INSERT INTO public.stage_history
    (customer_id, from_stage, to_stage, from_status, to_status, skipped_steps, event_id, changed_by)
  VALUES
    (NEW.customer_id, c.stage, d.key, c.status, c.status, v_skipped, NEW.event_id, auth.uid());

  RETURN NEW;
END $$;

-- ── 3. Status first, then stage ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS events_apply_status    ON public.events;
DROP TRIGGER IF EXISTS events_apply_stage     ON public.events;
DROP TRIGGER IF EXISTS events_10_apply_status ON public.events;
DROP TRIGGER IF EXISTS events_20_apply_stage  ON public.events;

CREATE TRIGGER events_10_apply_status
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.apply_status_from_event();

CREATE TRIGGER events_20_apply_stage
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.apply_stage_from_event();

COMMIT;

-- Sanity check: the live ladder in rank order.
SELECT key, rank, event_type, min_role, match_data FROM public.stage_defs WHERE is_live ORDER BY rank;
