-- ============================================================
-- PaisaDost — Auth & Roles Migration (additive)
-- Run this AFTER schema.sql in Supabase SQL Editor.
-- Does NOT drop or modify existing tables.
-- ============================================================

-- ── 1. profiles ──────────────────────────────────────────────────────────────
-- One row per auth user. Linked to auth.users via id.

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile      TEXT        UNIQUE NOT NULL,
  fullname    TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'sales',   -- 'admin' | 'manager' | 'sales'
  is_approved BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Helper function (avoids infinite recursion in RLS) ─────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Each user can read their own profile; admins and managers can read all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR get_my_role() = 'admin'
    OR get_my_role() = 'manager'
  );

-- Any authenticated user can create their own profile row (happens at signup)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Only admins can update any profile (approve, change role)
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (get_my_role() = 'admin' OR id = auth.uid());

-- ── 4. Add assigned_to on customers (needs profiles to exist first) ──────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_assigned_to_idx ON customers (assigned_to);

-- ── 5. IMPORTANT: Disable email confirmation ──────────────────────────────────
-- Go to Supabase Dashboard → Authentication → Providers → Email
-- Turn OFF "Confirm email" — field agents won't have email access.

-- ── 6. Bootstrap: promote the first admin manually ───────────────────────────
-- After the first user registers via the app, run this in SQL Editor:
--
--   UPDATE profiles SET role = 'admin', is_approved = true
--   WHERE mobile = '9999999999';   -- ← replace with your mobile number
--
-- All subsequent approvals can be done from the Admin Panel in the app.
