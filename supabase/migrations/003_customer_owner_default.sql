-- ============================================================
-- 003 — Every new lead belongs to the user who creates it (Batch 1, step 2)
--
-- Before: the app inserted the customer, then assigned it in a separate,
-- fire-and-forget call (`assignCustomer(...).catch(() => {})`). If that call
-- failed the lead had no owner and silently vanished from the agent's list.
-- When RLS arrives (assigned_to = auth.uid()), that insert would be rejected.
--
-- Setting ownership as a column default makes it atomic with the insert and
-- also covers older app versions still cached on phones.
-- ============================================================

ALTER TABLE public.customers
  ALTER COLUMN assigned_to SET DEFAULT auth.uid();

-- How many leads have no owner today? If > 0, run 004 next.
SELECT COUNT(*) AS unowned_leads
  FROM public.customers
 WHERE assigned_to IS NULL;
