-- ============================================================
-- 004 — Give unowned leads an owner (Batch 1, step 2 backfill)
--
-- Run only if 003 reported unowned_leads > 0.
--
-- Rule: owner = the approved user whose full name matches the salesman name on
-- the lead's FIRST event. Names that match more than one profile are skipped
-- (we never guess). Whatever is left gets assigned by hand in the Admin Panel.
--
-- Step A previews. Step B writes. Run A, read it, then run B.
-- ============================================================

-- ── A. Preview ───────────────────────────────────────────────────────────────
WITH first_event AS (
  SELECT DISTINCT ON (e.customer_id) e.customer_id, e.salesman_id
    FROM public.events e
    JOIN public.customers c ON c.customer_id = e.customer_id
   WHERE c.assigned_to IS NULL
     AND e.salesman_id IS NOT NULL
   ORDER BY e.customer_id, e.created_at ASC
),
name_match AS (
  SELECT lower(trim(fullname))   AS name_key,
         (array_agg(id))[1]      AS profile_id,
         COUNT(*)                AS matches
    FROM public.profiles
   WHERE is_approved
   GROUP BY 1
)
SELECT c.customer_id, c.shop_name, fe.salesman_id AS salesman_name,
       CASE WHEN nm.matches = 1 THEN 'will assign'
            WHEN nm.matches > 1 THEN 'skip: name matches several users'
            ELSE 'skip: no matching user' END AS outcome
  FROM public.customers c
  LEFT JOIN first_event fe ON fe.customer_id = c.customer_id
  LEFT JOIN name_match  nm ON nm.name_key = lower(trim(fe.salesman_id))
 WHERE c.assigned_to IS NULL
 ORDER BY outcome, c.created_at;

-- ── B. Apply (uncomment to run) ──────────────────────────────────────────────
-- WITH first_event AS (
--   SELECT DISTINCT ON (e.customer_id) e.customer_id, e.salesman_id
--     FROM public.events e
--     JOIN public.customers c ON c.customer_id = e.customer_id
--    WHERE c.assigned_to IS NULL
--      AND e.salesman_id IS NOT NULL
--    ORDER BY e.customer_id, e.created_at ASC
-- ),
-- name_match AS (
--   SELECT lower(trim(fullname)) AS name_key, (array_agg(id))[1] AS profile_id, COUNT(*) AS matches
--     FROM public.profiles
--    WHERE is_approved
--    GROUP BY 1
-- )
-- UPDATE public.customers c
--    SET assigned_to = nm.profile_id
--   FROM first_event fe
--   JOIN name_match nm ON nm.name_key = lower(trim(fe.salesman_id)) AND nm.matches = 1
--  WHERE c.customer_id = fe.customer_id
--    AND c.assigned_to IS NULL;
