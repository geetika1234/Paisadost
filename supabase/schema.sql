-- ============================================================
-- PaisaDost — Full Schema (v2)
-- Run this in Supabase SQL Editor.
-- WARNING: Drops existing tables first. Run on a fresh project.
-- ============================================================

DROP TABLE IF EXISTS repayments  CASCADE;
DROP TABLE IF EXISTS loans       CASCADE;
DROP TABLE IF EXISTS events      CASCADE;
DROP TABLE IF EXISTS customers   CASCADE;

-- ── 1. customers ─────────────────────────────────────────────────────────────
-- One row per unique customer. All interactions link back here via customer_id.

CREATE TABLE customers (
  customer_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  mobile        TEXT        UNIQUE,
  shop_name     TEXT,
  owner_name    TEXT,
  area          TEXT,
  landmark      TEXT,
  business_type TEXT,
  intent_level  TEXT        DEFAULT 'low',     -- low | medium | high
  stage         TEXT        DEFAULT 'visited', -- visited | pain_identified | roi_shown | login_started | approved | disbursed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. events ────────────────────────────────────────────────────────────────
-- Append-only log of every interaction. Central audit trail.
-- event_type: visit_done | pain_identified | roi_shown | login_started |
--             kyc_completed | approved | disbursed | emi_paid | default

CREATE TABLE events (
  event_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        REFERENCES customers(customer_id) ON DELETE CASCADE,
  salesman_id   TEXT,                -- salesman name / employee ID
  event_type    TEXT        NOT NULL,
  data          JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX events_customer_idx   ON events (customer_id, created_at DESC);
CREATE INDEX events_salesman_idx   ON events (salesman_id, event_type, created_at DESC);

-- ── 3. loans ─────────────────────────────────────────────────────────────────
CREATE TABLE loans (
  loan_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        REFERENCES customers(customer_id) ON DELETE CASCADE,
  loan_amount   NUMERIC,
  tenure        INTEGER,                        -- months
  interest_rate NUMERIC,                        -- % per annum
  status        TEXT        DEFAULT 'pending',  -- pending | approved | disbursed | closed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. repayments ────────────────────────────────────────────────────────────
CREATE TABLE repayments (
  repayment_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id       UUID        REFERENCES loans(loan_id) ON DELETE CASCADE,
  emi_amount    NUMERIC,
  due_date      DATE,
  paid          BOOLEAN     DEFAULT FALSE,
  delay_days    INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
