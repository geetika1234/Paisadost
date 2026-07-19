-- ============================================================
-- PaisaDost — Reminders / Follow-ups Migration (additive)
-- Run this AFTER schema.sql and auth_setup.sql.
-- Does NOT drop or modify existing tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  reminder_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  created_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  salesman_id   TEXT,                                     -- display name, mirrors events.salesman_id
  due_at        TIMESTAMPTZ NOT NULL,
  note          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',   -- 'pending' | 'done'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- Primary access pattern: "pending reminders due soonest first" — for one
-- salesman's leads or team-wide. Partial index keeps it small as
-- completed reminders accumulate.
CREATE INDEX IF NOT EXISTS reminders_due_idx
  ON reminders (due_at)
  WHERE status = 'pending';

-- Secondary pattern: "all reminders for this lead" (Workspace history)
CREATE INDEX IF NOT EXISTS reminders_customer_idx
  ON reminders (customer_id, due_at DESC);

-- No RLS — matches existing convention: only `profiles` has RLS enabled;
-- customers/events/loans/repayments are open to any authenticated client.
