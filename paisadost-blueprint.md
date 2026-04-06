# PaisaDost Decision Flow — Complete App Blueprint
> Mobile-first tool for NBFC field sales agents | Glide/AppSheet architecture

---

## PART 1: APP FLOW (Screen-by-Screen)

---

### SCREEN 1 — Business Details (Input Screen)
**Purpose:** Collect minimum viable data to run calculations

**UI Elements:**
| Field | Type | Values |
|---|---|---|
| Business Type | Dropdown | Kirana/General Store, Kapda/Textile, Pharmacy, Hardware, Dairy/Bakery, Auto Parts, Salon/Beauty, Other |
| Mahine ki Bikri (Monthly Sales) | Slider | ₹10K – ₹10L (step: ₹5,000) |
| Faida/Margin (Profit %) | Slider | 5% – 40% (step: 1%) |
| Business Kitne Saal Se Hai | Dropdown | < 1 year, 1–2 years, 2–5 years, 5+ years |
| Abhi Loan Chal Raha Hai? | Toggle | Haan / Nahi |
| Agar Haan — EMI Kitni? | Number Input | ₹0 – ₹50,000 (shown only if toggle = Haan) |

**Computed on this screen (hidden):**
```
monthly_profit = monthly_sales × (profit_pct / 100)
daily_profit = monthly_profit / 30
existing_emi_burden = existing_emi / monthly_profit  [risk flag if > 40%]
```

**CTA Button:** "Aage Badhein →" (Next)

---

### SCREEN 2 — Problem Selection Screen
**Purpose:** Anchor the customer to their pain before showing loss

**UI Elements:**
- Big headline: **"Aapka business kahan ruk raha hai?"**
- Multi-select tile buttons (emoji + text):

| Tile | Icon | Internal Tag |
|---|---|---|
| Maal khatam ho jaata hai | 📦 | STOCK_OUT |
| Machine/Equipment chahiye | ⚙️ | CAPEX |
| Dukaan bada karna hai | 🏪 | EXPANSION |
| Paison ki kami hoti hai | 💸 | WORKING_CAPITAL |
| Season mein zyada bikri hoti hai | 📈 | SEASONAL |
| Emergency padti rehti hai | 🚨 | EMERGENCY |

**Logic:** Customer selects 1–3 problems.
Each problem tag maps to a **loss multiplier** used in COD calculation.

**Loss Multipliers (internal):**
```
STOCK_OUT       → opportunity_loss_days = 5–8 days/month
CAPEX           → efficiency_loss_pct = 15%
EXPANSION       → growth_blocked_pct = 20%
WORKING_CAPITAL → liquidity_loss_days = 3–5 days/month
SEASONAL        → peak_miss_multiplier = 1.3×
EMERGENCY       → crisis_cost_pct = 10% of monthly sales
```

**CTA Button:** "Dekho Kitna Nuksaan Hai →"

---

### SCREEN 3 — COD Screen (Loss Visualization)
**Purpose:** Show the customer what inaction is COSTING them

**UI Layout:**
```
┌─────────────────────────────────┐
│  ⚠️  AAPKA NUKSAAN              │
│                                 │
│  Har DIN:    ₹ [daily_loss]     │  ← RED, big font
│  Har HAFTE:  ₹ [weekly_loss]    │  ← RED
│  Har MAHINE: ₹ [monthly_loss]   │  ← RED, LARGEST
│                                 │
│  Saal bhar mein agar kuch       │
│  nahi kiya:  ₹ [annual_loss]    │  ← DARK RED, bold
│                                 │
│  [?] Yeh kaise calculate hua?   │  ← Explain button
└─────────────────────────────────┘
```

**Formula Logic (simplified, no raw formulas shown):**
```
base_monthly_loss = monthly_profit × loss_pct_from_problems
daily_loss        = base_monthly_loss / 30
weekly_loss       = daily_loss × 7
monthly_loss      = base_monthly_loss
annual_loss       = monthly_loss × 12
```

**Loss % by problem combination:**
```
STOCK_OUT alone         → 20% of monthly profit lost
WORKING_CAPITAL alone   → 15% of monthly profit lost
CAPEX alone             → 15% efficiency loss on profit
EXPANSION alone         → 20% growth blocked (opportunity cost)
Multiple problems       → additive, capped at 50%
```

**Explain Button Text (Hinglish, no formulas):**
> "Jab aapke paas paise nahi hote, toh aap mauka chod dete ho. Yeh nuksaan woh paisa hai jo aap har mahine kama SAKTE the, par nahi kama rahe."

**CTA:** "Ab Dekho Loan Se Kya Faida Hoga →"

---

### SCREEN 4 — ROI Screen (Gain Visualization)
**Purpose:** Show what the loan WILL earn for them

**Input on this screen:**
| Field | Type | Range |
|---|---|---|
| Loan kitna chahiye? | Slider | ₹25K – ₹10L |
| Kitne time ke liye? | Segmented button | 6M / 12M / 18M / 24M |

**UI Layout:**
```
┌─────────────────────────────────┐
│  ✅  LOAN SE FAIDA               │
│                                 │
│  Expected Extra Kamaai:         │
│  Har Mahine: ₹ [extra_monthly]  │  ← GREEN
│  Poore Loan mein: ₹ [total_gain]│  ← GREEN, big
│                                 │
│  ─────────────────────────────  │
│  Loan ki Cost:                  │
│  EMI:      ₹ [emi_amount]       │  ← NEUTRAL
│  Kul Byaaj: ₹ [total_interest]  │  ← ORANGE
│                                 │
│  NET FAIDA: ₹ [net_roi]         │  ← GREEN, LARGEST
│                                 │
│  Loan ki Kamaai: [roi_pct]%     │
│  [?] Yeh kaise hua?             │
└─────────────────────────────────┘
```

**Formula Logic:**
```
interest_rate       = 18% per annum (NBFC standard; configurable)
emi_amount          = loan_amount × monthly_rate × (1+monthly_rate)^n
                      ÷ ((1+monthly_rate)^n − 1)
  where monthly_rate = 18%/12 = 1.5%
  where n = tenure_months

total_interest      = (emi_amount × n) − loan_amount
extra_monthly_sales = monthly_sales × growth_pct_from_problems
extra_monthly_profit= extra_monthly_sales × (profit_pct/100)
total_gain          = extra_monthly_profit × n
net_roi             = total_gain − total_interest
roi_pct             = (net_roi / total_interest) × 100
payback_months      = loan_amount / extra_monthly_profit
```

**Growth % by problem (what loan enables):**
```
STOCK_OUT       → +25% sales recovery
CAPEX           → +20% efficiency gain on existing sales
EXPANSION       → +30% revenue from new capacity
WORKING_CAPITAL → +15% from smoother operations
SEASONAL        → +35% peak season capture
EMERGENCY       → +10% stability gain
```

**Explain Button Text:**
> "Agar aap ₹[loan_amount] lagate ho apne business mein, toh aapki bikri zyada hogi aur paisa wapas aa jaayega. Byaaj se zyada kamaai hogi — yahi hai asli faida."

**CTA:** "Dono Ko Milake Dekho →"

---

### SCREEN 5 — Comparison Screen (Decision Moment)
**Purpose:** Force the aha-moment: cost of NOT taking loan vs. taking it

**UI Layout:**
```
┌─────────────────────────────────┐
│      LOAN LENA CHAHIYE KYA?     │
│                                 │
│  ❌ Agar Loan NAHI Liya:        │
│  ₹[annual_loss] ka nuksaan      │  ← RED card
│  Saal bhar mein                 │
│                                 │
│  ✅ Agar Loan LIYA:             │
│  ₹[net_roi] ka faida            │  ← GREEN card
│  Byaaj kaatke bhi               │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  FARK:  ₹[total_swing]          │  ← BIG, GOLD
│         [tenure] mahine mein    │
│                                 │
│  EMI:   ₹[emi_amount]/mahine    │
│  Aapka roz ka kharch:           │
│  sirf  ₹[daily_emi] /din        │  ← Anchor small
└─────────────────────────────────┘
```

**Logic:**
```
total_swing = annual_loss + net_roi
daily_emi   = emi_amount / 30
```

**Dynamic insight text:**
- If roi_pct > 200%: "Har ₹1 byaaj pe ₹[roi_pct/100] kamaai — bahut achha deal hai!"
- If payback_months < 6: "Loan [payback_months] mahine mein hi wapas ho jaayega!"
- If emi < 20% of monthly_profit: "EMI aapki kamaai ka sirf [emi_pct]% hai — bilkul manageable!"

**CTA:** "Score Dekho + Best Offer →"

---

### SCREEN 6 — Intelligence Screen (Customer Scoring)
**Purpose:** Build trust with data; give agent a talking point

**Customer Score (0–100):**

| Factor | Weight | Logic |
|---|---|---|
| Business Age | 20 pts | <1yr=5, 1-2yr=10, 2-5yr=15, 5+yr=20 |
| Profit Margin | 20 pts | <10%=5, 10-20%=10, 20-30%=15, >30%=20 |
| EMI Burden (existing) | 20 pts | >50%=0, 30-50%=8, <30%=20 |
| ROI % of Loan | 20 pts | <50%=5, 50-100%=10, 100-200%=15, >200%=20 |
| Problem Clarity | 20 pts | 1 problem=10, 2 problems=15, 3=20 |

**Score Bands:**
```
80–100 → "Excellent" (Green star)  — "Aap ek strong borrower hain!"
60–79  → "Good"      (Blue tick)   — "Aapka profile achha hai."
40–59  → "Fair"      (Yellow)      — "Kuch improvements ke saath loan milega."
<40    → "Review"    (Orange)      — "Hum milke solution dhundh sakte hain."
```

**Risk Flags (shown as badges):**
```
🔴 HIGH_EMI_RISK:    existing_emi > 40% of monthly_profit
🔴 LOW_ROI:          roi_pct < 50%
🟡 CASH_FLOW_RISK:   payback_months > tenure_months × 0.8
🟡 THIN_MARGIN:      profit_pct < 10%
🟢 STRONG_GROWTH:    roi_pct > 200%
🟢 QUICK_PAYBACK:    payback_months < tenure/2
```

**UI Layout:**
```
┌─────────────────────────────────┐
│  🎯 AAPKA SCORE                 │
│                                 │
│         [  82  ]                │  ← Big circle, color-coded
│       EXCELLENT ⭐               │
│                                 │
│  ✅ Purana business             │
│  ✅ Achhi margin                │
│  ✅ ROI bahut zyada             │
│  ⚠️  Pehle se EMI chal raha hai │
│                                 │
│  Agent Note (only agent sees):  │
│  "Strong profile. Upsell 20L    │
│   offer try karo."              │
└─────────────────────────────────┘
```

**CTA:** "Offer Dekho →"

---

### SCREEN 7 — Offer Screen (Loan Summary)
**Purpose:** Close. Clear, confident, actionable.

**Loan Recommendation Engine:**
```
recommended_loan = MIN(
  monthly_sales × 3,           ← Turnover-based cap
  monthly_profit × 18,         ← Repayment capacity
  loan_requested                ← What customer asked for
)

recommended_tenure = MAX(payback_months × 1.5, 12)  ← Comfortable buffer
recommended_tenure = MIN(recommended_tenure, 24)     ← Cap at 24M
```

**UI Layout:**
```
┌─────────────────────────────────┐
│  💰 AAPKE LIYE BEST OFFER       │
│                                 │
│  Loan Amount:  ₹[rec_loan]      │  ← BIG, GREEN
│  EMI:          ₹[rec_emi]/mah   │
│  Samay:        [rec_tenure] mah │
│  Byaaj:        18% yearly       │
│                                 │
│  ─────────────────────────────  │
│  Har mahine extra kamaai:       │
│  ₹[extra_monthly_profit]        │  ← GREEN
│                                 │
│  Loan clear hone ke baad:       │
│  ₹[net_roi] extra kamaai        │  ← BIG GREEN                  │
│                                 │
│  [Apply Karo]  [Baad Mein]      │
│                                 │
│  📤 Share karo customer ko      │  ← WhatsApp share button
└─────────────────────────────────┘
```

**WhatsApp Share Text (auto-generated):**
```
Namaste [customer_name] ji! 🙏

Aapke business ke liye humara suggestion:
✅ Loan: ₹[rec_loan]
✅ EMI: ₹[rec_emi]/mahine
✅ Expected faida: ₹[net_roi] (byaaj kaatke)

Aapka PaisaDost Score: [score]/100 ⭐

Aage badhne ke liye reply karein.
— [Agent Name], [NBFC Name]
```

---

## PART 2: GLIDE DATABASE STRUCTURE

---

### Table 1: `customer_inputs`
| Column | Type | Notes |
|---|---|---|
| id | Row ID | Auto |
| agent_id | Relation → agents | Who captured |
| customer_name | Text | |
| phone | Phone | |
| business_type | Choice | 8 options |
| monthly_sales | Number | Slider input |
| profit_pct | Number | Slider input |
| business_age | Choice | 4 buckets |
| existing_loan | Boolean | |
| existing_emi | Number | Conditional |
| problems | Multi-select | Tags array |
| loan_requested | Number | Screen 4 slider |
| tenure_requested | Number | 6/12/18/24 |
| created_at | Date/Time | Auto |
| status | Choice | Lead/Applied/Disbursed |

---

### Table 2: `cod_calculations` (Computed)
| Column | Type | Glide Formula |
|---|---|---|
| customer_id | Relation → customer_inputs | |
| monthly_profit | Math | `monthly_sales × profit_pct ÷ 100` |
| daily_profit | Math | `monthly_profit ÷ 30` |
| loss_pct | Math | Lookup from problem_loss_map |
| monthly_loss | Math | `monthly_profit × loss_pct` |
| daily_loss | Math | `monthly_loss ÷ 30` |
| weekly_loss | Math | `daily_loss × 7` |
| annual_loss | Math | `monthly_loss × 12` |

**problem_loss_map (Glide IF logic):**
```
IF problems contains STOCK_OUT → add 0.20
IF problems contains WORKING_CAPITAL → add 0.15
IF problems contains CAPEX → add 0.15
IF problems contains EXPANSION → add 0.20
IF problems contains SEASONAL → add 0.20
IF problems contains EMERGENCY → add 0.10
TOTAL → MIN(sum, 0.50)  [cap at 50%]
```

---

### Table 3: `roi_calculations` (Computed)
| Column | Type | Glide Formula |
|---|---|---|
| customer_id | Relation | |
| interest_rate_monthly | Math | `0.18 ÷ 12` = 0.015 |
| emi_amount | Math | `loan × 0.015 × (1.015^n) ÷ ((1.015^n)−1)` |
| total_interest | Math | `(emi × n) − loan` |
| growth_pct | Math | Lookup from problem_growth_map |
| extra_monthly_sales | Math | `monthly_sales × growth_pct` |
| extra_monthly_profit | Math | `extra_monthly_sales × profit_pct ÷ 100` |
| total_gain | Math | `extra_monthly_profit × tenure` |
| net_roi | Math | `total_gain − total_interest` |
| roi_pct | Math | `net_roi ÷ total_interest × 100` |
| payback_months | Math | `loan ÷ extra_monthly_profit` |
| daily_emi | Math | `emi ÷ 30` |

---

### Table 4: `customer_scores` (Computed)
| Column | Type | Formula |
|---|---|---|
| score_business_age | Math | IF age bucket → pts |
| score_margin | Math | IF profit_pct → pts |
| score_emi_burden | Math | IF existing_emi/profit → pts |
| score_roi | Math | IF roi_pct → pts |
| score_problems | Math | IF count(problems) → pts |
| total_score | Math | Sum of above |
| score_band | IF | Excellent/Good/Fair/Review |
| flag_high_emi | Boolean | `existing_emi > monthly_profit × 0.4` |
| flag_low_roi | Boolean | `roi_pct < 50` |
| flag_cash_flow | Boolean | `payback_months > tenure × 0.8` |
| flag_thin_margin | Boolean | `profit_pct < 10` |

---

### Table 5: `loan_recommendations` (Computed)
| Column | Type | Formula |
|---|---|---|
| cap_turnover | Math | `monthly_sales × 3` |
| cap_repayment | Math | `monthly_profit × 18` |
| recommended_loan | Math | `MIN(cap_turnover, cap_repayment, loan_requested)` |
| rec_tenure_raw | Math | `MAX(payback_months × 1.5, 12)` |
| recommended_tenure | Math | `MIN(rec_tenure_raw, 24)` |
| recommended_emi | Math | Recalculate EMI with rec_loan + rec_tenure |

---

### Table 6: `agents` (Reference)
| Column | Type |
|---|---|
| agent_id | Row ID |
| name | Text |
| phone | Phone |
| region | Text |
| nbfc_branch | Text |

---

## PART 3: FORMULA LOGIC (Simplified — No Raw Formulas)

### COD Logic in Plain English:
1. Find out how much profit the business makes per month
2. Based on the problems selected, estimate what % of that profit is being lost every month
3. Show that as daily / weekly / monthly / yearly loss
4. This loss is the "Cost of Delay" — what inaction costs them

### ROI Logic in Plain English:
1. Calculate what monthly payment (EMI) the loan will require
2. Calculate what additional income the loan will generate (based on problem type)
3. Subtract total loan cost from total extra income
4. What remains is the NET GAIN — the ROI

### Score Logic in Plain English:
1. Add points for business age (older = safer)
2. Add points for profit margin (higher = healthier)
3. Subtract points for existing EMI burden (if too high, risk)
4. Add points for how good the ROI is
5. Add points for problem clarity (specific problem = better fit)

---

## PART 4: UI TEXT (Hinglish)

### Screen Labels:
```
Monthly Sales     → "Mahine mein kitni bikri hoti hai?"
Profit %          → "Kitna faida milta hai (%)?"
Business Age      → "Dukaan/Business kitne saal se hai?"
Existing Loan     → "Koi aur loan abhi chal raha hai?"
Existing EMI      → "Uski EMI kitni hai?"
Problems          → "Business mein kya problem hai?"
Loan Amount       → "Kitna loan chahiye?"
Tenure            → "Kitne time mein bhar denge?"
```

### Key Display Phrases:
```
Daily Loss        → "Aapka roz ka nuksaan"
Monthly Loss      → "Mahine bhar ka nuksaan"
Annual Loss       → "Ek saal mein total nuksaan"
Extra Income      → "Loan se extra kamaai"
Net Gain          → "Asli faida (byaaj kaatke)"
EMI               → "Har mahine bhar na hoga"
Score             → "Aapka business score"
Recommended Loan  → "Aapke liye sahi loan"
```

### Button Text:
```
Next              → "Aage Badhein →"
Calculate COD     → "Nuksaan Dekho"
Calculate ROI     → "Faida Dekho"
See Comparison    → "Fark Dekho"
See Offer         → "Apna Offer Dekho"
Apply             → "Apply Karo ✅"
Share             → "WhatsApp pe Bhejo 📲"
Explain           → "Samjhao Mujhe 🤔"
```

---

## PART 5: SALES SCRIPT (Screen-by-Screen)

### Screen 1 — Business Details:
> **Agent says:** "[Customer name] ji, pehle aapka business samajhte hain. Koi calculation nahi — bas 2 minute mein dekh lenge aapke liye kya sahi hai."

### Screen 2 — Problem Selection:
> **Agent says:** "Inme se kaunsi cheez aapko rok rahi hai? Ek se zyada bhi select kar sakte ho."
*(Wait for customer to tap. Don't rush. Let them feel heard.)*

### Screen 3 — COD Screen:
> **Agent says:** "Dekho — yeh loan ki baat nahi hai. Yeh woh paisa hai jo aap ALREADY kho rahe ho. Har din ₹[daily_loss]. Saal mein ₹[annual_loss]. Yeh toh already ja raha hai."

*(Pause. Let the red number sink in.)*

### Screen 4 — ROI Screen:
> **Agent says:** "Ab dekho — agar hum yeh problem solve kar dein... toh extra kamaai kitni hogi. Aur humara charge? Sirf ₹[total_interest] — total. Aur kamaai? ₹[total_gain]."

### Screen 5 — Comparison Screen:
> **Agent says:** "Ek taraf ₹[annual_loss] ka nuksaan. Doosri taraf ₹[net_roi] ka faida. Fark hai ₹[total_swing]. Toh aap decide karo — loan lena chahiye ya nahi?"

*(This is a closing question. Wait for response.)*

### Screen 6 — Intelligence Screen:
> **Agent says:** "Aapka business score hai [score]/100. [Score band message]. Matlab aap ek achhe borrower hain — hum aapko best rate de sakte hain."

*(If risk flags: "Ek cheez dhyan rakhna..." — address flag honestly.)*

### Screen 7 — Offer Screen:
> **Agent says:** "Aapke liye best offer hai ₹[rec_loan] — ₹[rec_emi] mahine mein. Roz ka kharch sirf ₹[daily_emi]. Chai se bhi kam. Aur faida? [tenure] mahine mein ₹[net_roi]."

*(Share WhatsApp summary with customer before leaving.)*

---

## PART 6: SUGGESTED IMPROVEMENTS

### Tier 1 — Quick Wins (1–2 weeks):
1. **Voice Input** — Agent speaks sales/turnover, Whisper API converts to number (low-skill agent support)
2. **WhatsApp Bot Integration** — Customer pre-fills their own data before agent visit
3. **Vernacular Language Toggle** — Hindi / Hinglish / Regional (Marathi, Tamil, etc.)
4. **Offline Mode** — Glide PWA works without internet (field use)
5. **Competitor Comparison** — "Other banks dete hain X% — humare se Y% kam"

### Tier 2 — Intelligence Layer (1 month):
6. **Bureau Lite Score** — Link to CRIF / Experian soft-pull API for real credit score
7. **GST Turnover Fetch** — Auto-fill sales data from GST portal (with consent)
8. **Seasonal Pattern Engine** — Festival calendar awareness (Diwali, harvest season)
9. **Agent Leaderboard** — Score agents by conversion rate, avg ticket size
10. **Loan Product Matching** — Auto-match to Term Loan / OD / MSME / KCC based on profile

### Tier 3 — Underwriting Integration (2–3 months):
11. **Bank Statement Analyser** — Upload PDF → auto-extract avg monthly credits
12. **Photo-to-Data** — Agent photographs shop → AI estimates size/inventory/footfall
13. **Geo-enrichment** — Pin location → area income profile, competition density
14. **Cohort Benchmarking** — "Aapke jaise [business_type] ki average kamaai ₹X hai — aap kitne?"
15. **Churn Predictor** — Flag customers likely to prepay or go silent post-disbursement

### Tier 4 — Full Sales OS:
16. **Follow-up CRM** — Automated WhatsApp nudges at D+1, D+3, D+7
17. **Manager Dashboard** — Pipeline view, score distributions, risk flag alerts
18. **Document Collection** — In-app camera → Aadhaar, PAN, shop photo upload
19. **E-Sign** — Loan agreement signed on phone at customer's shop
20. **Repayment Nudge Bot** — EMI reminder 3 days before due date via WhatsApp

---

## QUICK REFERENCE: Variable Map

| Variable | Source | Used In |
|---|---|---|
| monthly_sales | Screen 1 slider | COD, ROI, Score, Recommendation |
| profit_pct | Screen 1 slider | COD, ROI, Score |
| business_age | Screen 1 dropdown | Score |
| existing_emi | Screen 1 conditional | Score, Risk Flag |
| problems[] | Screen 2 tiles | COD loss_pct, ROI growth_pct |
| loan_requested | Screen 4 slider | ROI, Recommendation |
| tenure_requested | Screen 4 buttons | ROI, Recommendation |
| interest_rate | Config (18%) | ROI (hardcoded, NBFC configurable) |
| monthly_profit | Computed | COD, ROI, Score |
| monthly_loss | Computed | COD, Comparison |
| net_roi | Computed | ROI, Comparison, Offer |
| total_score | Computed | Intelligence screen |
| recommended_loan | Computed | Offer screen |

---

*Built for: PaisaDost — NBFC Field Sales Tool*
*Architecture: Glide / AppSheet compatible*
*Target User: Field sales agent + Small business customer*
