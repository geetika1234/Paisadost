-- ============================================================
-- 007 — Stage engine (Batch 2, part A: additive)
--
-- Safe to run while the CURRENT app is live. It adds tables, columns and
-- triggers but takes nothing away. Run 008 only after deploying the
-- Batch 2 app.
--
-- Model:
--   stage   = how far a lead has ever got. Forward-only. Set by the DB from
--             events (trigger below), never by the app.
--   status  = is the lead alive right now (active / nurture / ...). Column
--             added here; the rules that change it ship in Batch 3.
--
-- Live stages (ranks leave gaps so future stages need no renumbering):
--   new 0 (lead_created) → visited 10 (visit_done, 3 photos)
--   → pain_identified 20 → roi_shown 50 → login_started 80
-- Retired: approved 90, disbursed 100. No event sets them any more; they
-- stay in stage_defs only so existing leads at those stages keep ranking
-- above login_started and are never moved back.
-- ============================================================

BEGIN;

-- ── 1. Stage definitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stage_defs (
  key        TEXT    PRIMARY KEY,
  rank       INTEGER NOT NULL UNIQUE,
  event_type TEXT    UNIQUE,                     -- NULL for retired stages
  min_role   TEXT    NOT NULL DEFAULT 'sales'
             CHECK (min_role IN ('sales', 'manager', 'admin')),
  min_photos INTEGER NOT NULL DEFAULT 0,         -- evidence gate on the event's data.photoUrls
  is_live    BOOLEAN NOT NULL DEFAULT true
);

-- min_photos for visited starts at 0 so the currently deployed app (whose
-- Quick Create still writes a photo-less visit_done) keeps working. 008 raises it to 3.
INSERT INTO public.stage_defs (key, rank, event_type, min_role, min_photos, is_live) VALUES
  ('new',              0, 'lead_created',    'sales', 0, true),
  ('visited',         10, 'visit_done',      'sales', 0, true),
  ('pain_identified', 20, 'pain_identified', 'sales', 0, true),
  ('roi_shown',       50, 'roi_shown',       'sales', 0, true),
  ('login_started',   80, 'login_started',   'sales', 0, true),
  ('approved',        90, NULL,              'admin', 0, false),
  ('disbursed',      100, NULL,              'admin', 0, false)
ON CONFLICT (key) DO UPDATE
  SET rank = EXCLUDED.rank, event_type = EXCLUDED.event_type, min_role = EXCLUDED.min_role,
      is_live = EXCLUDED.is_live;

ALTER TABLE public.stage_defs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_defs_read" ON public.stage_defs;
CREATE POLICY "stage_defs_read" ON public.stage_defs FOR SELECT USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.stage_defs FROM anon;

-- ── 2. Lead columns ──────────────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stage_rank       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status           TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason    TEXT,
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_status_check
    CHECK (status IN ('active', 'nurture', 'not_qualified', 'lost', 'rejected', 'dormant'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New leads start at 'new'. (Column defaults apply before BEFORE triggers, so
-- the old DEFAULT 'visited' would otherwise label every new lead as visited.)
-- Today's app always sends an explicit stage, so this changes nothing until Batch 2 ships.
ALTER TABLE public.customers ALTER COLUMN stage SET DEFAULT 'new';

-- Existing leads keep their stage exactly as it is; only the rank is filled in.
UPDATE public.customers c
   SET stage_rank = d.rank
  FROM public.stage_defs d
 WHERE d.key = c.stage
   AND c.stage_rank IS DISTINCT FROM d.rank;

CREATE INDEX IF NOT EXISTS customers_stage_idx        ON public.customers (stage);
CREATE INDEX IF NOT EXISTS customers_status_idx       ON public.customers (status);
CREATE INDEX IF NOT EXISTS customers_owner_created_idx ON public.customers (assigned_to, created_at DESC);

-- ── 3. Stage history (funnel + lead timeline read-model) ─────────────────────
CREATE TABLE IF NOT EXISTS public.stage_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  from_stage    TEXT,
  to_stage      TEXT,
  from_status   TEXT,
  to_status     TEXT,
  reason        TEXT,
  skipped_steps TEXT[],
  event_id      UUID        REFERENCES public.events(event_id) ON DELETE SET NULL,
  changed_by    UUID        REFERENCES public.profiles(id)     ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stage_history_customer_idx ON public.stage_history (customer_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS stage_history_funnel_idx   ON public.stage_history (to_stage, changed_at DESC);

ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_history_read" ON public.stage_history;
-- Matches customers today (any approved user). Batch 3 narrows both together.
CREATE POLICY "stage_history_read" ON public.stage_history FOR SELECT USING (public.am_i_approved());
REVOKE ALL ON public.stage_history FROM anon;
-- No write policies: rows come only from the SECURITY DEFINER triggers below.

-- One starting row per existing lead so the funnel is not empty on day one.
INSERT INTO public.stage_history (customer_id, from_stage, to_stage, to_status, reason, changed_at)
SELECT c.customer_id, NULL, c.stage, c.status, 'backfill', c.created_at
  FROM public.customers c
 WHERE NOT EXISTS (SELECT 1 FROM public.stage_history h WHERE h.customer_id = c.customer_id);

-- ── 4. Who did what: events.created_by ───────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.events ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS events_created_by_idx ON public.events (created_by, event_type, created_at DESC);

-- Old events carry only a salesman NAME. Match it to exactly one approved user; never guess.
WITH name_match AS (
  SELECT lower(trim(fullname)) AS name_key, (array_agg(id))[1] AS profile_id, COUNT(*) AS matches
    FROM public.profiles
   WHERE is_approved
   GROUP BY 1
)
UPDATE public.events e
   SET created_by = nm.profile_id
  FROM name_match nm
 WHERE e.created_by IS NULL
   AND nm.matches = 1
   AND nm.name_key = lower(trim(e.salesman_id));

-- ── 5. Forward-only guard on customers.stage ─────────────────────────────────
-- Defence in depth: whatever path writes `stage` (the event trigger, an old
-- app version still on a phone, a manual SQL fix), a lower stage is ignored
-- and stage_rank always matches stage.
CREATE OR REPLACE FUNCTION public.keep_stage_forward()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rank INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage := COALESCE(NEW.stage, 'new');
    SELECT rank INTO v_rank FROM public.stage_defs WHERE key = NEW.stage;
    IF v_rank IS NULL THEN
      RAISE EXCEPTION 'stage_unknown: %', NEW.stage USING ERRCODE = '22023';
    END IF;
    NEW.stage_rank := v_rank;
    RETURN NEW;
  END IF;

  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    NEW.stage_rank := OLD.stage_rank;        -- rank only moves with stage
    RETURN NEW;
  END IF;

  SELECT rank INTO v_rank FROM public.stage_defs WHERE key = NEW.stage;
  IF v_rank IS NULL OR v_rank <= OLD.stage_rank THEN
    NEW.stage      := OLD.stage;             -- unknown or backwards: keep what we had
    NEW.stage_rank := OLD.stage_rank;
  ELSE
    NEW.stage_rank := v_rank;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_keep_stage_forward ON public.customers;
CREATE TRIGGER customers_keep_stage_forward
  BEFORE INSERT OR UPDATE OF stage, stage_rank ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.keep_stage_forward();

-- ── 6. Event → stage trigger ─────────────────────────────────────────────────
--
--   event inserted
--     └─ event_type not in stage_defs ............. nothing (notes, responses, ...)
--     └─ caller role below min_role ................ REJECT event (stage_role_denied)
--     └─ fewer photos than min_photos .............. REJECT event (stage_evidence_missing)
--     └─ lead closed (lost/rejected/...) ........... keep event, stage unchanged
--     └─ rank <= current rank ...................... keep event, stage unchanged
--     └─ otherwise ................................. advance stage + stage_history row
--
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
  SELECT * INTO d FROM public.stage_defs WHERE event_type = NEW.event_type AND is_live;
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

DROP TRIGGER IF EXISTS events_apply_stage ON public.events;
CREATE TRIGGER events_apply_stage
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.apply_stage_from_event();

COMMIT;

-- Sanity check: every lead's rank matches its stage.
SELECT c.stage, c.stage_rank, COUNT(*) AS leads
  FROM public.customers c
 GROUP BY 1, 2
 ORDER BY 2;
