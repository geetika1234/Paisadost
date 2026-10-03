-- ============================================================
-- 002 — Remove anonymous access to CRM tables (Batch 1)
--
-- customers / events / loans / repayments / reminders have no RLS yet, and
-- Supabase grants table privileges to the `anon` role by default. The anon key
-- ships inside the public JS bundle, so without this anyone on the internet
-- could read or change every lead without logging in.
--
-- The app never touches these tables before login (S_Auth only calls
-- supabase.auth and inserts into profiles with a session), so nothing breaks.
-- Logged-in users keep access until RLS lands in a later batch.
-- ============================================================

BEGIN;

REVOKE ALL ON TABLE
  public.customers,
  public.events,
  public.loans,
  public.repayments,
  public.reminders,
  public.profiles
FROM anon;

-- Tables created later by this role start without anon access too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;
