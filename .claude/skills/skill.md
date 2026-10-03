# AR Financiers CRM — Lead Stages, Qualification & Nurture Spec

> **Status:** Draft v1 for planning · 26 Sep 2026
> **Owner:** Founder, AR Financiers
> **Repo note:** The repo folder is still named `Paisadost-main`. The product and company are **AR Financiers** (package name and auth domain are already `arfinanciers`). Treat "Paisadost" in code as a legacy name.

---

## 0. How to use this document (read first)

This is the product spec for re-designing how leads move through the AR Financiers field-sales CRM. It was written after a codebase audit (commit `52dbbc2`, branch `main`) and a series of product decisions with the founder.

- **Plan before coding.** Run `/plan-ceo-review` and `/plan-eng-review` on this document first. Challenge anything that looks wrong.
- **Verify against the code.** The "current state" in §2 comes from the audit. Confirm each point in the code before changing it.
- **Do not guess where this doc says "TBD".** §18 lists open questions. Ask the founder; do not invent values.
- **Customer-facing Hindi/Hinglish text is canonical.** Do not rephrase questions shown to shopkeepers. Store answers as stable English codes; show Hindi on screen.
- **Build in the phase order of §17.** Security first. Each phase ends with `/review` and `/qa`.

---

## 1. Context

AR Financiers is an NBFC giving **business loans of ₹2L–₹21L** to kirana and small retail shopkeepers. Field salesmen visit shops and use a mobile-first CRM (Hindi/Hinglish UI, phone-shaped shell) to:

1. Record the visit and the shop's profile.
2. Run a consultative **Pain Discovery** conversation.
3. Show an on-screen **ROI and Cost-of-Delay (COD) calculator** (ported from `ROI and cost of delay nbfc.xlsx`) to justify the loan.
4. Push the lead to file login.

**Goal of this change:** a lead system that measures *real, verified progress*, never loses a customer who said "not now", and tells each agent exactly what to do next.

---

## 2. Current state and problems (from audit — verify in code)

**Stack:** React 18 + Vite 5 + Tailwind 3; Supabase (Postgres + Auth + Storage) called directly from the browser with the anon key; no router (screen chosen by a priority chain of booleans in `App.jsx`); global state in `context/AppContext.jsx`; DB wrappers in `lib/db/`; pure logic in `logic/calculations.js` and `logic/problems.js`. No tests.

**Data:** `events` is an append-only log (`event_type` + `data` JSONB). `customers` holds one row per lead (`stage`, `intent_level`, `assigned_to`, unique `mobile`). Also `reminders`, `profiles`, `loans` (write-only), `repayments` (unused), `photos` bucket.

**Current stage machine:** `addEvent()` maps event type → stage via `STAGE_MAP` and updates the customer **fire-and-forget from the browser**:
`visited → pain_identified → roi_shown → login_started → approved → disbursed`. `approved` and `disbursed` are never emitted.

**Problems this spec fixes:**

| # | Problem | Consequence |
|---|---|---|
| P1 | Quick Create writes `visit_done` | A lead typed in from home counts as a visit; the 20 visits/day target can be padded |
| P2 | "Not interested" (`customer_response`) never changes stage | Dead leads sit at `roi_shown` forever; funnel numbers are wrong |
| P3 | No stages between ROI and login; `approved`/`disbursed` unreachable | No view of documentation, negotiation, credit or disbursal |
| P4 | Stage is written from the browser, fire-and-forget, with no role check | Updates can silently fail; any user could mark a lead disbursed |
| P5 | Intent calculated in 3 places with different weights: `lib/utils/intent.js`, `S_Dashboard.deriveIntent()`, inline score in `S_Workspace` | The same lead shows different intent on different screens |
| P6 | RLS only on `profiles`; approval (`is_approved`) enforced only in `App.jsx` | Any authenticated user can read/write/delete every customer, event, loan and reminder |
| P7 | Problem option lists differ between the profile form and Pain Discovery | Answers can't be pre-filled, nurtured on, or reported together |

---

## 3. Core rules (non-negotiable)

1. **A stage is a verified milestone.** It records something that provably happened, never how keen the customer seemed.
2. **Intent is a separate score.** Stage says *where* the lead is; intent says *how likely* it converts. Stage is **not** an input to intent.
3. **Stages only move forward.** The only ways "back" are the exit statuses (§6) and an explicit, logged **Reopen**.
4. **Stage changes happen in the database**, via a Postgres trigger on `events` insert — never directly from the browser.
5. **Follow-up is a task, not a stage.** Every open lead has a next follow-up (§14).
6. **No lead shows HIGH intent unless it has passed the Money (M) check.**
7. **Nobody is lost for "not now".** Timing problems go to Nurture with a date, not to Lost.

---

## 4. Full flow

```
SHOP VISIT
 │
 ├─ Level 1: Samanya Jaankari   (silent GPS captured when form opens)
 ├─ Short pitch  →  outcome: ENGAGED / NOT ENGAGED (+ reason)
 ├─ Level 2: Vyapar Jaankari    (Q1–Q9, all customers)
 └─ Level 3: GPS + live photos  →  stage = VISITED
          │
          ├── NOT ENGAGED ─────────────────────────────►  status = NURTURE
          │                                                (problem + timing drive it)
          │                                                        ▲
          └── ENGAGED                                              │
                 │                                                 │
             Pain Discovery (Q1–Q8)  →  stage = PAIN_IDENTIFIED    │
                 │                                                 │
             Q7 capital need + Q7b "aage badhein?"                 │
                 ├─ nahi ──────────────────────────────────────────┤
                 ├─ sochunga → stay, follow-up                     │
                 └─ haan → stage = INTERESTED                      │
                        │                                          │
                  Eligibility Gate (KYC, age, bank, area,          │
                  amount, CIBIL, property)                         │
                        ├─ knock-out ──► status = NOT_QUALIFIED    │
                        ├─ current default ────────────────────────┤
                        │                                          │
                  MUTANT scoring                                   │
                        ├─ M or N fail ──► NOT_QUALIFIED           │
                        ├─ U or Time fail ─────────────────────────┘
                        ├─ A or Trust fail → task, stay INTERESTED
                        └─ pass → stage = QUALIFIED
                               │
                        ROI pitch (soft bureau check first) → ROI_SHOWN
                               │
                        NEGOTIATION → DOCS_COLLECTION → LOGIN_STARTED
                               │
                        APPROVED (sanctioned) → DISBURSED
```

---

## 5. Stages

Keep existing DB keys where they exist (`visited`, `pain_identified`, `roi_shown`, `login_started`, `approved`, `disbursed`) so historical data stays valid. Add new keys. Store a numeric `stage_rank` so "forward only" is a simple comparison.

| Rank | Key | UI label (Hinglish) | Set by event | Required evidence (block the move if missing) | Who can trigger | Time target |
|---|---|---|---|---|---|---|
| 0 | `new` | Nayi Lead | `lead_created` | Level 1 fields; mobile not already in system | Sales | — |
| 10 | `visited` | Visit Hua | `visit_done` | Level 1 + Level 2 (all Q answered or "बताया नहीं") + Level 3 (≥3 live photos, GPS check passed) | Sales | Same day as `new` |
| 20 | `pain_identified` | Pain Pata Chala | `pain_identified` | Pain Q1 category + sub-problem, Q2, Q3 (loss area + ₹), Q5 | Sales | — |
| 30 | `interested` | Interested | `interest_confirmed` | Pain Q7 = haan **and** Q7b = haan; loan amount needed (Pain Q8) | Sales | — |
| 40 | `qualified` | Qualified | `qualification_done` | Eligibility gate pass; MUTANT M ≥ 1, N ≥ 1, A ≥ 1 | Sales (system computes) | ≤ 3 days from `interested` |
| 50 | `roi_shown` | ROI Dikhaya | `roi_shown` | Soft bureau check done (or TBD override); loan amount > 0; recommendation computed; score band present | Sales | — |
| 60 | `negotiation` | Baat-cheet | `negotiation_started` | Customer agreed in principle; offered amount, rate, tenure recorded | Sales | Response within 3 days of `roi_shown` |
| 70 | `docs_collection` | Documents | `doc_uploaded` (first) | Terms agreed; checklist started | Sales | — |
| 80 | `login_started` | File Login | `login_started` | **Document checklist 100% complete** (§18: checklist TBD) | Sales → hands to Credit | ≤ 7 days from `interested` |
| 90 | `approved` | Sanctioned | `sanctioned` | Sanctioned amount, rate, tenure → write `loans` row | Manager / Credit / Admin only | Credit decision ≤ 72h from login |
| 100 | `disbursed` | Disbursed | `disbursed` | UTR number, date, amount → create `repayments` schedule | Admin / Ops only | — |

**Skipping:** if an event implies a higher stage than the next one (e.g. ROI saved before Pain Discovery), move to the higher stage and log `skipped_steps` in `stage_history` for quality reporting.

---

## 6. Exit statuses

Add a `status` column separate from `stage`. `stage` keeps the highest milestone reached; `status` says whether the lead is active.

| Status | When | Reason required (codes) | Comes back how |
|---|---|---|---|
| `active` | Default | — | — |
| `nurture` | Not engaged at visit; Pain Q7 = nahi; Q7b = nahi; MUTANT U/Time fail; current default | `not_engaged`, `no_capital_need`, `not_now`, `timing`, `clear_dues_first` | Revisit task on `money_need_date` countdown (§13); any new activity reactivates |
| `not_qualified` | Eligibility knock-out; MUTANT M or N fail | `kyc_missing`, `business_too_new`, `no_bank_account`, `area_not_serviced`, `amount_out_of_range`, `cibil_*`, `low_repayment_capacity`, `need_not_loan_fixable` | Manager Reopen only (logged) |
| `lost` | Dropped during ROI/negotiation/docs | `rate_too_high`, `doesnt_need`, `went_to_competitor`, `family_said_no`, `unreachable`, `other` (text) | Manager Reopen only |
| `rejected` | Credit declined at/after login | Credit reason code (list TBD) | Manager Reopen only |
| `dormant` | No event for 30 days **or** 3 follow-ups unanswered | auto | First new event reactivates |

**Credit query** after login is **not** a status: set `sub_status = credit_query`, stage stays `login_started`, owner becomes the agent until cleared.

---

## 7. Level 1 — Samanya Jaankari (every visit)

Captured first. **GPS is captured silently when this form opens** (`lat`, `lng`, `accuracy`, `timestamp`) — before any typing.

| Field | Type | Rule |
|---|---|---|
| दुकान का नाम | text | required |
| दुकान मालिक का नाम | text | required |
| गांव/शहर का नाम (जहाँ व्यापार चलता है) | text | required |
| मार्केट का नाम | text | required |
| मोबाइल नंबर | 10-digit | required; duplicate check against `customers.mobile` |
| किससे बात हुई | single: `owner` / `family` / `staff` | required |
| Pitch ka result | single: `engaged` / `not_engaged` | required |
| Not engaged reason (if not engaged) | single: `busy_now` / `no_loan_wanted` / `has_existing_loan` / `owner_absent` / `other` (text) | required if not engaged |
| WhatsApp consent | checkbox, Hindi consent line (text TBD) | optional; **no WhatsApp messages without it** |

Saving Level 1 creates the customer with `stage = new` (event `lead_created`). **This replaces Quick Create writing `visit_done`.**

---

## 8. Level 2 — Vyapar Jaankari (every visit)

**Rules for all questions:**
- Keep this exact order (it is designed to be conversational).
- All 9 are **required**, and every question has a **"बताया नहीं" (`not_answered`)** option. This forces the agent to ask and records refusal separately from skipping.
- **Q1 may be filled by the agent by observation.**
- Selecting "others" opens a text/number box.
- Store English codes; display Hindi.
- For engaged customers these answers **pre-fill Pain Discovery and the ROI tool**. Nothing is asked twice. (This overlaps the existing `S_CustomerForm` step 2 — reuse/replace it, don't duplicate.)

**Q1. किस चीज़ का व्यापार है?** (single)
`kirana`, `hardware`, `electronics`, `electrical`, `clothes`, `dairy` (milk/dairy), `medicine`, `shoes`, `services`, `auto_parts`, `fancy_store`, `paint`, `furniture`, `other` (text)

**Q2. आपकी लाइन में सीजन कब आता है? (सबसे ज़्यादा बिक्री का समय)** (multi)
`summer`, `rainy`, `winter`, `diwali`, `wedding`, `post_harvest`, `school_opening`, `full_year`

**Q3. अगर पूरे साल की बात करें, तो सबसे ज़्यादा बिक्री किन महीनों में होती है?** (multi)
`jan` … `dec`, `all_12`

**Q4. सीजन शुरू होने से पहले आमतौर पर कितने दिन पहले तैयारी शुरू करनी पड़ती है?** (single)
`15d`, `30d`, `45d`, `60d`, `other` (number of days). Store as integer `prep_days`.

**Q5. किस समय बिजनेस में सबसे ज़्यादा पैसा लगाना पड़ता है?** (multi)
`season_time`, `stock_finishing`, `supplier_pressure`, `good_opportunity`

**Q6. और जब सीजन नहीं रहता, तब महीने की बिक्री लगभग कितनी रह जाती है? (ऑफ सीजन बिक्री)** (single)

| Code | Label | Stored `offseason_sales_value` (₹) |
|---|---|---|
| `lt_50k` | 50,000 से कम | 40,000 — **auto-flag `likely_below_min_loan`** (3× monthly sales < ₹2L floor) |
| `50k_1_5l` | 50,000 – 1.5 लाख | 1,00,000 |
| `1_5l_2_5l` | 1.5 – 2.5 लाख | 2,00,000 |
| `2_5l_3_5l` | 2.5 – 3.5 लाख | 3,00,000 |
| `3_5l_5l` | 3.5 – 5 लाख | 4,25,000 |
| `gt_5l` | 5 लाख से ज़्यादा | 5,00,000 (conservative floor) |
| `other` | typed | typed value |

(Stored values are midpoints/conservative estimates for calculation only — confirm with founder, §18.)

**Q7. आजकल आपके हिसाब से बिजनेस को आगे बढ़ाने में सबसे बड़ी रुकावट क्या है? (कोई दो चुनें)** (pick up to 2; **first tap = primary problem**; `no_big_problem` is exclusive)

Each option maps to a Pain Discovery category + sub-problem (see §10.1).

`less_stock`, `season_demand_unmet`, `daily_expenses`, `udhari_stuck`, `supplier_pressure`, `scheme_discount_missed`, `less_sales`, `less_footfall`, `competition`, `renovation_display`, `no_big_problem`

**Q8. क्या कभी सिर्फ पैसों की कमी की वजह से कोई अच्छा बिजनेस मौका छोड़ना या टालना पड़ा?** (single)
`yes`, `no`

**Q9. अभी market में दो तरह के लोग हैं—कुछ लोग अपना व्यापार बढ़ा रहे हैं और कुछ लोग अभी जैसे चल रहा है उसे मेंटेन करने पर... आप किस तरफ ज़्यादा ध्यान दे रहे हैं?** (single)
`grow`, `maintain`

**Derived fields (computed, not asked):**
- `money_need_date` — see §13.1.
- `warmth` — `warm` if Q8 = yes or Q9 = grow; `hot_nurture` if both; else `cold`.

---

## 9. Level 3 — GPS + photos (completes the visit)

- **Live camera only**; gallery upload disabled.
- **Minimum 3 photos**, each canvas-stamped with GPS and reverse-geocoded address (existing behaviour — keep).
- **Location check:** distance between Level 1 GPS and photo GPS ≤ 100 m (configurable). If it fails → `visit_flag = location_mismatch` (manager review), stage still moves but the visit does not count toward targets until cleared.
- **Time at shop** = last photo timestamp − Level 1 GPS timestamp. Store `visit_duration_sec`. Flag visits under 2 minutes (configurable).
- Submitting Level 3 emits `visit_done` → stage `visited`. If not engaged, status → `nurture` in the same transaction.

---

## 10. Pain Discovery (engaged customers only)

Opens pre-filled from Level 2. Questions and options below are the founder's current version; **items marked "PROPOSED" are recommended changes pending founder confirmation (§18).**

### 10.1 Problem taxonomy (shared)

Pain Q1 categories (existing, in `logic/problems.js` — verify): `cash_flow`, `stock_refill_bulk`, `shop_improvement_expansion`, `footfall`, `slow_sales_stock_stuck`, `competition_pressure`, `emergency_repairs`, `other`. Each has sub-problems in code.

**Mapping from Level 2 Q7 → Pain category → sub-problem** (store the **sub-problem**, not just the category — nurture content and COD buckets depend on it):

| Level 2 Q7 option | Pain category | Sub-problem | COD bucket (`calculateCOD`) |
|---|---|---|---|
| `less_stock` | `stock_refill_bulk` | stock shortage | seasonal stock-outs / competitor walk-aways |
| `season_demand_unmet` | `stock_refill_bulk` | season stock | seasonal stock-outs |
| `daily_expenses` | `cash_flow` | daily expenses | fixed-expense inflation |
| `udhari_stuck` | `cash_flow` | udhari | udhari / outstanding credit |
| `supplier_pressure` | `cash_flow` | supplier pressure | supplier price rises |
| `scheme_discount_missed` | `cash_flow` | scheme/discount | missed supplier discounts |
| `less_sales` | `slow_sales_stock_stuck` | — | — (weak loan fit; affects N) |
| `less_footfall` | `footfall` | — | competitor walk-aways |
| `competition` | `competition_pressure` | — | competitor walk-aways |
| `renovation_display` | `shop_improvement_expansion` | — | — (renovation use-case) |
| `no_big_problem` | — | — | — (weak N) |

**Action:** if `cash_flow` in `problems.js` does not already include sub-problems *daily expenses* and *scheme/discount*, add them. `emergency_repairs` has no Level 2 option — acceptable.

### 10.2 Questions

**Q1. Business Ka Sabse Bada Challenge** (pre-filled with Level 2 Q7 primary; agent confirms, then drills into sub-problem)
> Sabse pehle ye batayein — aapke business me is waqt sabse bada challenge kya chal raha hai?
> "Sir, ek baat batayein — abhi business mein koi aisi cheez hai jo aapko lagta hai: agar ye theek ho jaye toh meri life easy ho jaye?"

Options: `cash_flow`, `stock_refill_bulk`, `shop_improvement_expansion`, `footfall`, `slow_sales_stock_stuck`, `competition_pressure`, `emergency_repairs`, `other` (text) → then sub-problem drill-down from `problems.js`.

**Q2. Problem Kab Se Hai**
> Ye problem aapko kab se face karni pad rahi hai?
> "Aapko kab mehsus hua ki is pareshani ne aapko gher rakha hai?"

Input: years + months. Store `problem_duration_months` (integer).

**Q3. Nuksaan Kahan Ho Raha Hai**
> Is problem ki wajah se aapko sabse zyada nuksaan kis cheez me ho raha hai — sales me, stock me, ya customer chhod ke ja rahe hain?

Current: repeats the problem list with deeper sub-problem drill-down.
**PROPOSED:** move the sub-problem drill-down to Q1 (above) and change Q3 options to the *type of loss*: `sales_lost`, `stock_shortage`, `customers_to_competitor`, `paying_higher_price` (lower margin), `cash_stuck_in_credit`, `other`. **Add:** "Mahine ka lagbhag kitna nuksaan?" as ₹ ranges (ranges TBD) → store `monthly_loss_value`. This feeds COD and the ROI pitch.

**Q4. Future Impact**
> Agar ye problem agle 3–6 mahine me solve nahi hoti, toh kya ho sakta hai?
> "Aapke hisaab se business pe kya asar padega?"

Free text (keep — the customer saying it himself is persuasive). **PROPOSED:** optional quick tags (`sales_will_fall`, `customers_to_competitor`, `debt_will_grow`, `business_may_close`) and voice note (reuse existing voice dictation).

**Q5. Priority Check**
> Main samajhna chahta hoon ji — abhi aapke liye sabse important kya hai: problem solve karna ya aur wait karna thoda time?

Options: `solve_now`, `will_wait`.
**PROPOSED:** if `solve_now`, ask "Kab tak?": `within_7d`, `within_1m`, `before_season`. Feeds MUTANT U and Time.

**Q6. Emotional Connect**
> Is situation se aapko zaroor thodi bahut tension hoti hogi — chahe wo business chalane ki ho, personal stress ho, ya parivar ki zimmedaariyon ki… thoda bata paoge iske baare mein?
> *(Listen and acknowledge)* "Bilkul samajh sakta hoon — har business owner is phase se kabhi na kabhi guzarta hai."

Free text. **Optional**, voice note allowed. **Never used in scoring, never shown on dashboards or manager lists, never used in WhatsApp content.** Treat as sensitive personal data.

**Q7. Capital Zaroorat**
> Aapne jo problem batayi hai — aapke hisaab se, kya ye dikkat bina extra capital laaye solve ho sakti hai, ya thoda financial support lena zaroori lagta hai?
> "Jo problem aapne batai, kya wo sirf mehnat se solve ho sakti hai, ya usme paisa bhi lagana padega?"

Options: `haan_zaroorat_hai`, `nahi`.
- `nahi` → status `nurture`, reason `no_capital_need`.

**Q7b. PROPOSED (new) — Interest confirmation** (only if Q7 = haan)
> "Sahi sharton pe mile, toh kya aap humse baat aage badhana chahenge?"

Options: `haan` → stage `interested` · `sochunga` → stay `pain_identified` + mandatory follow-up · `nahi` → status `nurture`, reason `not_now`.
(Needing capital ≠ wanting it from AR Financiers; this question separates them.)

**Q8. Growth Vision**
> Current: "Agar ye paisa agle 5–7 din me mil jaye, toh aapka business agle 30 din me kitna badh sakta hai?"
> **PROPOSED wording (compliance):** "Agar ye paisa **sahi samay pe** mil jaye, toh aapka business agle 30 din me kitna badh sakta hai?" — a specific day count can read as a disbursal promise (RBI Fair Practices Code).
> "Aap kya karoge sabse pehle — stock badhaoge, customer offer doge ya expansion loge?"

Current: free text. **PROPOSED:** add options `increase_stock`, `customer_offer`, `expansion`, `pay_supplier`, `other` + free text; **add "Kitne paise chahiye?"** (₹ amount) → `loan_amount_needed`. Required for the eligibility range check.

### 10.3 Stage effects

- Submit with required fields → `pain_identified`.
- Q7/Q7b outcomes as above.

---

## 11. Eligibility gate (after `interested`, before MUTANT)

Ask these **only after Interested**, worded gently (e.g. "Koi purana loan toh baaki nahi hai?"). Never at the first pitch.

### 11.1 Basic knock-outs (yes/no; any "no" → `not_qualified`)

| Check | Rule |
|---|---|
| KYC | PAN + Aadhaar available |
| Business age | ≥ TBD years (1 or 2 — §18) |
| Bank account | Active, with regular transactions |
| Shop proof | GST / Udyam / Shop Act (list TBD) |
| Service area | Pincode in serviceable list (TBD) |
| Amount | `loan_amount_needed` between ₹2,00,000 and ₹21,00,000 |

### 11.2 CIBIL

**Step 1 — self-declared (field):**
`clean`, `no_history` (never taken a loan / NTC), `dont_know`, `old_default_closed`, `past_dpd`, `current_default`, `settlement`, `suit_filed`, `written_off_wilful`

**Step 2 — soft bureau check** with explicit customer consent, **before `roi_shown`** (provider TBD). A soft enquiry must not affect the customer's score.

| Result | Outcome |
|---|---|
| `suit_filed`, `written_off_wilful` | `not_qualified` (hard reject) |
| `settlement` | Recent → `not_qualified`; old with NOC → credit review flag (recency threshold TBD) |
| `current_default` (overdue now) | `nurture`, reason `clear_dues_first` — not Lost |
| `past_dpd` (30+ days in last 12 months) | Pass with flag `credit_review` |
| `old_default_closed` | Pass with flag `credit_review` |
| `clean` | Pass |
| `no_history` | **Pass** — assess on sales/bank statements. Do not reject NTC customers |
| `dont_know` | Pass to Step 2; outcome decided by bureau result |

All thresholds are **TBD with credit head** (§18).

### 11.3 Property (routes the product — **never a rejection reason** for unsecured)

1. Owns property? multi: `none`, `residence`, `shop`, `land`
2. In whose name? `self`, `spouse`, `father`, `other_family` → if not self, flag `co_applicant_needed` (feeds MUTANT A)
3. Document type: `registered_sale_deed`, `society_unapproved_colony`, `gram_panchayat_patta`, `agricultural_land`, `gift_deed_registered`, `gift_deed_unregistered`, `poa_notary_only`

Effects:
- Owns residence → stability signal (+ to M).
- Clear title → eligible for secured product route (bigger amount / lower rate — product rules TBD).
- Agricultural land, patta, notary-only → record but don't count as collateral.
- **Accepted/not-accepted list: CONFIRM WITH CREDIT HEAD.**

---

## 12. MUTANT qualification

MUTANT = **M**oney · **U**rgency · **T**rust · **A**uthority · **N**eed · **T**ime. Each letter scores 0 / 1 / 2 from **structured inputs** — never from the agent's self-rating.

| Letter | Meaning | Inputs | 2 | 1 | 0 |
|---|---|---|---|---|---|
| **M** Money | Can repay EMI | `monthly_profit = offseason_sales_value × margin%` (margin: from ROI inputs or ask — TBD); `emi_capacity = 50% × monthly_profit − existing_emis`; `proposed_emi` for `loan_amount_needed` at indicative rate/tenure | capacity ≥ 1.5 × EMI | ≥ 1.0 × EMI | < 1.0 × EMI |
| **U** Urgency | Customer's need timing | Pain Q5 + "Kab tak" | solve_now & ≤ 30 days | 1–3 months / before season | will_wait / > 3 months |
| **T** Trust | Openness to us | Signals: Q6 sales answered (not `not_answered`); photos allowed; WhatsApp consent / personal mobile; no bad prior NBFC experience (new yes/no question) | 3–4 signals | 2 | 0–1 |
| **A** Authority | Can decide & is the borrower | Decision maker (`self` / `father` / `brother` / `spouse` / `other`); shop in whose name; co-applicant needed & available | self decides & shop in own name | co-decision, co-applicant available & willing | decision maker not met |
| **N** Need | Our loan solves his problem | Pain Q7 = haan; primary problem is loan-fixable (not `no_big_problem`; `less_sales` = partial); Q3 ₹ loss present | all true | partial | Q7 = nahi or not loan-fixable |
| **T** Time | We can deliver in time | `days_to_need = money_need_date − today` vs AR Financiers disbursal TAT (TBD) | ≥ TAT | ≥ TAT − 7 days | < TAT − 7 |

All ratios and cut-offs are **proposed — confirm (§18).**

### 12.1 Outcomes

| Condition | Result |
|---|---|
| Eligibility pass **and** M ≥ 1, N ≥ 1, A ≥ 1 | stage → `qualified` |
| M = 0 or N = 0 | status → `not_qualified` (`low_repayment_capacity` / `need_not_loan_fixable`) |
| U = 0 or Time = 0 (others OK) | status → `nurture` (`timing`), revisit on `money_need_date` countdown |
| A = 0 | stay `interested`; task "Meet decision maker" |
| Trust = 0 | stay `interested`; task "Second visit + customer reference" |

### 12.2 Intent (single source of truth)

- Output two values: **`qualified`** (bool) and **`intent_level`** (`HIGH` / `MEDIUM` / `LOW`).
- `intent_level` from U + Trust + Time + latest `customer_response` (interested / thinking / not interested). Cut-offs TBD; proposal: HIGH ≥ 5 of 6, MEDIUM 3–4, LOW ≤ 2.
- **HIGH is only possible if `qualified = true` (M passed).**
- **Stage is not an input.**

### 12.3 Code changes (intent merge)

1. Turn `lib/utils/intent.js` into the single MUTANT function (`computeMutant(customer, events) → { letters, qualified, intent_level, flags }`). Reuse its existing inputs (urgency → U, capital need → N, customer response → Trust/intent); remove stage as an input.
2. Delete `S_Dashboard.deriveIntent()` and the inline score in `S_Workspace`; both call the single function.
3. Fold the "Hot lead" badge (interested + wants it now + needs capital + ROI shown) into `qualified && intent_level = HIGH`.
4. Keep HIGH / MEDIUM / LOW labels (the team knows them).
5. Cache the result in `customers.intent_level` (+ new `mutant` JSONB) whenever a relevant event is inserted, so list views can filter without recomputing.

---

## 13. Nurture engine

### 13.1 Money-need date

```
season_start   = first day of the next upcoming month selected in Level 2 Q3
money_need_date (T) = season_start − prep_days (Level 2 Q4)
```
- Multiple seasons → use the one that comes first from today.
- `full_year` / `all_12` → no season date: revisit every 60 days; use Level 2 Q5 as the message hook.
- `not_answered` on Q3/Q4 → default revisit in 45 days (configurable).

### 13.2 Countdown

| When | Action | Channel |
|---|---|---|
| Visit day | Thank-you with agent name/photo + one tip on primary problem | WhatsApp (if consent) |
| Monthly (1–2×) | Help content on primary sub-problem — no selling | WhatsApp |
| T − 60 | Season-prep content + personalised COD number (from his Q6 sales) | WhatsApp |
| T − 45 | Soft offer: "Season se pehle stock ke liye ₹X tak" (X from `calculateRecommendation`: min of 3× monthly sales etc.) | WhatsApp |
| **T − 30** | **Auto-created revisit task for the agent** | CRM task |
| T − 15 | Last call | CRM task |
| After season | Cool down; restart countdown for next season | — |

**Early revisit overrides** (from Level 1): `busy_now` or `owner_absent` → revisit in 3–7 days; spoke to `staff` → revisit in 7 days; ignore the season countdown for the first revisit.

### 13.3 Priority matrix (revisit list sort order)

| | Season near (T ≤ 45 days) | Season far |
|---|---|---|
| **Warm** (Q8 yes or Q9 grow) | Revisit now | Content + T−30 visit |
| **Cold** | One offer + visit | Light content only |

`hot_nurture` (Q8 yes **and** Q9 grow) always sorts to the top.

### 13.4 Content map (by sub-problem)

| Sub-problem | Content angle (help, not selling) | Later loan hook |
|---|---|---|
| Stock shortage | "Khaali shelf = grahak doosri dukaan pe", fast-moving item list | Stock loan |
| Season stock | Season-prep checklist | Stock before season |
| Daily expenses | Cash-flow tips, separate business/home expenses | Working capital |
| Udhari | Credit recovery tips, UPI reminders, credit limits | Fill working-capital gap |
| Supplier pressure | Negotiating better supplier terms | Buy on own terms |
| Scheme/discount | "2% cash discount = saal bhar me kitna" | Cash purchase to capture discount |
| Less sales | Stock mix, what's selling | (weak fit) |
| Less footfall | Google listing, WhatsApp catalogue | Range + display |
| Competition | Display, combo offers | Wider range |
| Renovation/display | Low-cost display ideas, before/after | Renovation loan |

Formats: 30-second Hindi voice notes (ideally from the same agent), short videos, single-number image cards. Not articles.

### 13.5 WhatsApp rules

- **Consent required** (Level 1 checkbox). DPDP Act.
- WhatsApp Business API with approved templates; provider TBD.
- **Max 2–4 messages per month** per customer. Honour STOP immediately.
- Reply buttons: "Haan, baat karni hai" / "Abhi nahi". "Haan" → intent bump + agent task (call/visit within 24h). Stage changes only when the visit/call happens.
- **Wording:** name the lending partner (TBD); never "guaranteed approval", "pakka loan", or specific disbursal days (RBI Fair Practices Code).
- **Phase note:** WhatsApp can ship after in-app revisit tasks (§17 phase 7). The countdown and tasks work without it.

---

## 14. Follow-ups

Built on the existing `reminders` table.

- **Every open lead (stages `pain_identified` → `login_started`, status `active`) must have a future follow-up.** Saving without one is blocked.
- Add `purpose`: `decision_pending`, `docs_pending`, `negotiation`, `credit_query`, `meet_decision_maker`, `revisit_nurture`, `other`.
- Add `attempt_no` and `outcome` (`reached`, `no_answer`, `rescheduled`).
- "Sochunga / thinking" answers create a follow-up automatically; stage does not change.
- **3 consecutive `no_answer` → status `dormant`.**
- Manager view: overdue follow-ups by agent and by purpose.

---

## 15. Dashboard changes

- **Visits** = count of `visit_done` events that passed the Level 3 location check (not Quick Creates, not `new`). Target 20/day, 400/month (existing).
- **Logins** = count of `login_started` with 100% checklist. Target 40/month (existing).
- **Funnel** = conversion between stages, from `stage_history`.
- **Time in stage** = median days per stage, from `stage_history`.
- **Nurture board** = upcoming revisits by T-date and priority.
- **Quality** = visits flagged (location/duration), skipped steps, `not_answered` rate per agent.

---

## 16. Data model changes

**`customers`** — add: `status`, `status_reason`, `sub_status`, `stage_rank`, `next_followup_at`, `money_need_date`, `warmth`, `mutant` (JSONB), `visit_flag`. Keep `stage`, `intent_level`, `assigned_to`.

**New table `stage_history`**: `id`, `customer_id`, `from_stage`, `to_stage`, `from_status`, `to_status`, `reason`, `skipped_steps`, `changed_by`, `changed_at`.

**New/updated event types:** `lead_created`, `visit_done` (now requires Level 3), `pain_identified`, `interest_confirmed`, `eligibility_checked`, `bureau_checked`, `qualification_done`, `roi_shown`, `negotiation_started`, `doc_uploaded`, `login_started`, `credit_query`, `sanctioned`, `rejected`, `disbursed`, `lead_lost`, `status_changed`, `reopened`. Keep existing: `customer_response`, `loan_requirement`, `note_added`.

**Stage trigger** (Postgres, `AFTER INSERT ON events`):
1. Map `event_type` → target stage/status.
2. Validate required evidence in `NEW.data` (per §5). Reject the insert if missing.
3. Check role via `get_my_role()`: `sanctioned`/`rejected` need manager/credit/admin; `disbursed` needs admin/ops.
4. Only raise `stage_rank`; never lower it (except `reopened` by manager).
5. Update `customers`, insert `stage_history` — same transaction.
6. Remove the browser-side `STAGE_MAP` update in `addEvent()`.

**Migration of existing data:**
- Customers at `visited` with fewer than 3 photos → `new`.
- Customers with `customer_response = not_interested` → status `nurture`, reason `not_now`.
- Backfill `stage_rank` and one `stage_history` row per customer.

---

## 17. Build plan (in this order)

Each phase: plan → build → `/review` → `/qa` → test checklist passes → next phase.

| Phase | Scope | Must pass before moving on |
|---|---|---|
| **1. Security** | RLS on `customers`, `events`, `reminders`, `loans`, `repayments`, photos bucket. Sales see only `assigned_to = auth.uid()`; managers see their team (team model TBD); admins see all. Enforce `is_approved` in RLS. | A sales user cannot read another agent's lead via the API; unapproved user gets zero rows |
| **2. Stage engine** | `status` + new columns, `stage_history`, new event types, Postgres trigger with role checks, migration | Cannot skip evidence; cannot move backwards; sales cannot emit `sanctioned`/`disbursed`; history row per change |
| **3. Visit (Levels 1–3)** | Replace Quick Create; Level 2 Q1–Q9 with codes; live-camera photos; GPS check; duration | Quick Create alone never counts as a visit; location mismatch flagged |
| **4. Pain Discovery** | Shared taxonomy + mapping; pre-fill; confirmed PROPOSED changes; Q7/Q7b stage effects | Level 2 answers appear pre-filled; sub-problem stored |
| **5. Eligibility + MUTANT** | Gate, CIBIL, property, `computeMutant`, intent merge (delete 2 duplicates) | Same lead shows same intent on every screen; HIGH impossible without M pass |
| **6. Follow-ups** | Mandatory next follow-up, purpose, attempts, dormant rule | Open lead can't be saved without follow-up; 3 no-answers → dormant |
| **7. Nurture** | `money_need_date`, countdown tasks, priority sort; then WhatsApp (consent, templates, buttons) | Revisit tasks appear on correct dates; no message without consent |
| **8. Dashboard** | New visit/login definitions, funnel, time-in-stage, nurture board, quality | Numbers reconcile with `stage_history` |

Also recommended (from audit, low effort): add a lint + test script; remove dead code (`S_SavedCustomers`, `S_SalesAssistant` entry-less screens, re-export shims, unused `DEFAULT_INPUTS`); remove committed `._*`, `.DS_Store`, stale lock file.

---

## 18. Open questions (ask — do not guess)

**Product / flow**
1. Confirm the PROPOSED Pain Discovery changes: Q3 loss-type options + ₹ loss ranges; Q4 tags; Q5 "kab tak"; Q7b; Q8 wording + options + amount.
2. For engaged customers, is Level 2 asked before Pain Discovery (recommended), or merged into it?
3. WhatsApp consent text (Hindi).
4. Stored midpoint values for Level 2 Q6 sales ranges — OK?
5. Team model: does each manager own a fixed set of agents? (needed for RLS)

**Credit / policy (credit head)**
6. Minimum business age (1 or 2 years).
7. Accepted shop-proof documents.
8. Serviceable pincodes/areas.
9. CIBIL thresholds: settlement recency, DPD levels, minimum score if any.
10. Accepted property/document types and secured-product rules.
11. KYC & document checklist for file login (drives the 100% checklist gate).
12. Credit rejection reason codes.

**Numbers**
13. MUTANT cut-offs (M ratios 1.5× / 1.0×; intent HIGH/MEDIUM/LOW bands).
14. Margin % source for M (ROI input, industry default by business type, or new question).
15. Indicative rate/tenure used for `proposed_emi` before ROI.
16. Average disbursal TAT (for Time letter).
17. GPS radius (default 100 m) and minimum visit duration (default 2 min).

**Vendors**
18. Soft bureau provider.
19. WhatsApp Business API provider.
20. Lending partner name to show in customer messages.