-- ============================================================
-- 009 — Lead status rules (Batch 3)
--
-- status says whether a lead is alive right now; stage (007) says how far it
-- ever got. Status changes only through events, decided here:
--
--   event                         rule
--   ----------------------------  ------------------------------------------------
--   customer_response "Nahi"      active → nurture (automatic)
--   customer_response "Interested" nurture/dormant → active (automatic)
--   status_changed {status,reason}
--       admin / manager           any status (rejected only once Login Done)
--       sales                     own lead, active/nurture → lost | not_qualified
--       anything else             REJECT (status_change_denied)
--
-- Every change writes a stage_history row (stage unchanged, status from → to).
-- Safe to run while the current app is live: it only reacts to events.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_status_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        public.customers%ROWTYPE;
  v_new    TEXT;
  v_reason TEXT;
  v_role   TEXT;
  v_closed CONSTANT TEXT[] := ARRAY['not_qualified', 'lost', 'rejected', 'dormant'];
BEGIN
  IF NEW.event_type NOT IN ('customer_response', 'status_changed') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'status_changed' THEN
    v_new    := NEW.data ->> 'status';
    v_reason := NULLIF(trim(NEW.data ->> 'reason'), '');

    IF v_new IS NULL OR v_new NOT IN ('active', 'nurture', 'not_qualified', 'lost', 'rejected', 'dormant') THEN
      RAISE EXCEPTION 'status_invalid: %', v_new USING ERRCODE = '22023';
    END IF;
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'status_reason_required' USING ERRCODE = '23514';
    END IF;
    IF length(v_reason) > 300 THEN
      RAISE EXCEPTION 'status_reason_too_long' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO c FROM public.customers WHERE customer_id = NEW.customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NEW.event_type = 'customer_response' THEN
    IF NEW.data ->> 'response' = 'not_interested' AND c.status = 'active' THEN
      v_new := 'nurture';  v_reason := 'Customer ne Nahi bola';
    ELSIF NEW.data ->> 'response' = 'interested' AND c.status IN ('nurture', 'dormant') THEN
      v_new := 'active';   v_reason := 'Customer interested';
    ELSE
      RETURN NEW;          -- response recorded, status unchanged
    END IF;
  ELSE
    -- Requests without an end-user JWT (SQL editor, service role) are trusted.
    IF auth.uid() IS NOT NULL THEN
      IF NOT public.am_i_approved() THEN
        RAISE EXCEPTION 'not_approved' USING ERRCODE = '42501';
      END IF;
      v_role := public.get_my_role();
      IF v_role NOT IN ('admin', 'manager') AND (
           c.assigned_to IS DISTINCT FROM auth.uid()
        OR v_new NOT IN ('lost', 'not_qualified')
        OR c.status = ANY (v_closed)
      ) THEN
        RAISE EXCEPTION 'status_change_denied' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF v_new = 'rejected' AND c.stage_rank < 80 THEN
      RAISE EXCEPTION 'status_rejected_needs_login' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_new = c.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.customers
     SET status = v_new, status_reason = v_reason
   WHERE customer_id = NEW.customer_id;

  INSERT INTO public.stage_history
    (customer_id, from_stage, to_stage, from_status, to_status, reason, event_id, changed_by)
  VALUES
    (NEW.customer_id, c.stage, c.stage, c.status, v_new, v_reason, NEW.event_id, auth.uid());

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS events_apply_status ON public.events;
CREATE TRIGGER events_apply_status
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.apply_status_from_event();

COMMIT;
