/**
 * PaisaDost — Calculation Engine
 * All formulas translated from: "ROI and cost of delay nbfc.xlsx"
 *
 * Sheet: Cost_of_Delay  →  calculateCOD()
 * Sheet: ROI            →  calculateROI()
 * Sheet: Inputs         →  inputs object (defaults match Excel sample)
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

export function fmtINR(n, compact = false) {
  const abs = Math.abs(Math.round(n));
  let str;
  if (abs >= 10000000)      str = `₹${(abs / 10000000).toFixed(1)} Cr`;
  else if (abs >= 100000)   str = `₹${(abs / 100000).toFixed(1)}L`;
  else if (abs >= 1000)     str = `₹${(abs / 1000).toFixed(0)}K`;
  else                      str = `₹${abs.toLocaleString('en-IN')}`;
  return n < 0 ? `-${str}` : str;
}

export function fmtINRFull(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function calcEMI(principal, annualRatePct, tenureMonths) {
  const r = annualRatePct / (100 * 12);
  if (r === 0) return principal / tenureMonths;
  const pow = Math.pow(1 + r, tenureMonths);
  return principal * r * pow / (pow - 1);
}

// ─── Default Inputs (matching Excel sample values) ──────────────────────────

export const DEFAULT_INPUTS = {
  // Customer identity
  customerName:           '',
  customerMobile:         '',

  // Business
  businessType:           'kirana',
  businessAge:            '2-5',

  // Sales & Profit — Inputs!B16, B17
  monthlySales:           100000,
  profitMargin:           20,       // %

  // Stock — Inputs!B2, B4
  monthlyStockPurchase:   300000,
  stockRotationDays:      45,

  // Supplier Discounts — Inputs!B9, B10, B11
  bulkDiscount:           5,        // %
  schemeDiscount:         3,        // %
  cashDiscount:           2,        // %

  // Stock price increase — Inputs!B12
  stockPriceIncreasePct:  5,        // %

  // Season — Inputs!B18, B19
  seasonUplift:           20,       // %
  seasonMonths:           3,

  // Competition — Inputs!B23, B24, B25
  dailyWalkins:           20,
  lostCustomersPct:       50,       // % of daily walkins lost to competitor
  avgBillValue:           2000,

  // Udhari / Credit — Inputs!B28, B29, B30
  creditDaysGiven:        20,
  actualUdhari:           50000,
  idealUdhariDays:        7,        // configurable, was hardcoded at 7
  udhariIncreasing:       false,    // B30: stable = false, increasing = true

  // Fixed Expenses — Inputs!B33, B34, B35, B36
  rent:                   10000,
  electricity:            500,
  salaries:               20000,
  expenseGrowthPct:       10,       // % per year

  // Inflation — Inputs!B39
  inflationRate:          7,        // % per year (stored as % not decimal)

  // Loan
  loanAmount:             500000,
  tenureMonths:           24,
  interestRate:           21,       // % mid of 18-25%
  businessLoanPct:        100,      // % of loan used for business (rest = personal)

  // Existing loan
  existingLoan:           false,
  existingEMI:            0,

  // Family income
  familyIncome:           0,

  bizTypes:               [],
  bizTypeOther:           '',
  problems:               [],
  subProblems:            [],
}

export const BLANK_INPUTS = {
  customerName: '', customerMobile: '',
  businessType: '', businessAge: '',
  monthlySales: 0, profitMargin: 0,
  monthlyStockPurchase: 0, stockRotationDays: 0,
  bulkDiscount: 0, schemeDiscount: 0, cashDiscount: 0, stockPriceIncreasePct: 0,
  seasonUplift: 0, seasonMonths: 0,
  dailyWalkins: 0, lostCustomersPct: 0, avgBillValue: 0,
  creditDaysGiven: 0, actualUdhari: 0, idealUdhariDays: 0, udhariIncreasing: false,
  rent: 0, electricity: 0, salaries: 0, expenseGrowthPct: 0,
  inflationRate: 0,
  loanAmount: 0, tenureMonths: 0, interestRate: 21, businessLoanPct: 100,
  existingLoan: null, existingEMI: 0,
  familyIncome: 0,
  bizTypes: [], bizTypeOther: '',
  problems: [], subProblems: [],
}

// ─── Cost of Delay ──────────────────────────────────────────────────────────
// Formula source: Cost_of_Delay sheet B3:B56

export function calculateCOD(inp) {
  const {
    monthlySales, profitMargin, monthlyStockPurchase, stockRotationDays,
    lostCustomersPct, avgBillValue,
    seasonUplift, seasonMonths,
    actualUdhari, idealUdhariDays,
    rent, electricity, salaries, expenseGrowthPct,
    inflationRate, stockPriceIncreasePct,
    bulkDiscount, schemeDiscount, cashDiscount,
  } = inp

  const pf          = profitMargin / 100                  // profit fraction
  const cycles      = 365 / stockRotationDays             // B6: stock cycles/year
  const totalDisc   = (bulkDiscount + schemeDiscount + cashDiscount) / 100
  const inflFrac    = (inflationRate ?? 7) / 100          // B39: now stored as %, convert here

  // 1. Competitor Loss
  // (dailyWalkins × lostPct% × avgBill × 30) × profitMargin × 40%
  const lostPerDay       = (inp.dailyWalkins ?? 0) * ((lostCustomersPct ?? 0) / 100)
  const lostSalesMonth   = lostPerDay * avgBillValue * 30
  const competitorProfit = lostSalesMonth * pf * 0.40

  // 2. Missed Supplier Discounts — B8, B9
  // Only the utilization % of stock is bought in bulk — discount missed on that portion
  const utilFrac       = 0.60  // fixed 60% of stock eligible for bulk discount
  const stockFromLoan  = (inp.loanAmount ?? 0) * ((inp.businessLoanPct ?? 100) / 100)
  const missedDiscount = (stockFromLoan * utilFrac * totalDisc * cycles) / 12

  // 3. Seasonal Loss — B16, B17, B18
  // Sales you miss because you run out of stock during peak season
  const seasonLossProfit    = monthlySales * (seasonUplift / 100) * seasonMonths * pf // B17
  const avgSeasonLossMonth  = (seasonLossProfit / 12) * 0.60

  // 4. Fixed Expense Inflation — B25
  // Your fixed costs go up every year; this is the extra burden per month
  const monthlyExpenseRise = (rent + electricity + salaries) * (expenseGrowthPct / 100) // B25

  // 5. Rupee Inflation Erosion — B31, B32, B33
  // Same profit, but worth less due to inflation
  const monthlyProfit   = monthlySales * pf                              // B31
  const inflationLoss   = monthlyProfit * inflFrac                       // B33

  // 6. Udhari (Outstanding Credit) Loss
  //
  // Case A — actual udhari <= ideal (credit days still over ideal):
  //   business loss = (actualUdhari × profit% / 30) × (creditDays − idealDays)
  //   interest loss = (actualUdhari × 1%      / 30) × (creditDays − idealDays)
  //
  // Case B — actual udhari > ideal:
  //   business loss = ((actual − ideal) × profit% / 30) × idealDays          ← Part 1
  //                 + (actual × profit%            / 30) × (creditDays − idealDays) ← Part 2
  //   interest loss = ((actual − ideal) × 1%       / 30) × idealDays
  //                 + (actual × 1%                 / 30) × (creditDays − idealDays)
  //
  const idealUdhari        = (monthlySales / 30) * (idealUdhariDays ?? 7)
  const excessCreditDays   = Math.max(0, (inp.creditDaysGiven ?? 0) - (idealUdhariDays ?? 7))
  const excessUdhari       = Math.max(0, actualUdhari - idealUdhari)   // how much actual > ideal

  let udhariProfitLoss, udhariInterestLoss
  let part1Profit = 0, part1Interest = 0, part2Profit = 0, part2Interest = 0

  if (excessUdhari > 0) {
    // Case B — two parts
    part1Profit   = (excessUdhari  * pf   / 30) * (idealUdhariDays ?? 7)
    part1Interest = (excessUdhari  * 0.01 / 30) * (idealUdhariDays ?? 7)
    part2Profit   = (actualUdhari  * pf   / 30) * excessCreditDays
    part2Interest = (actualUdhari  * 0.01 / 30) * excessCreditDays
    udhariProfitLoss   = part1Profit   + part2Profit
    udhariInterestLoss = part1Interest + part2Interest
  } else {
    // Case A — single part (credit days over ideal, actual within ideal)
    part2Profit   = (actualUdhari * pf   / 30) * excessCreditDays
    part2Interest = (actualUdhari * 0.01 / 30) * excessCreditDays
    udhariProfitLoss   = part2Profit
    udhariInterestLoss = part2Interest
  }

  const totalUdhariLoss = (udhariProfitLoss + udhariInterestLoss) * 0.60  // 60% realization
  const effectiveUdhari = actualUdhari   // for display reference

  // 7. Stock Price Inflation — B48, B49
  // Your supplier is charging more every year; eats into margin
  const stockPriceRiseMonth = ((stockFromLoan * (365 / stockRotationDays)) / 12) * (stockPriceIncreasePct / 100) * (profitMargin / 100) * 0.70

  // ─ Total ─
  const monthlyCoD = competitorProfit + missedDiscount + avgSeasonLossMonth
                   + monthlyExpenseRise + inflationLoss + totalUdhariLoss + stockPriceRiseMonth

  return {
    competitorProfit,
    missedDiscount,
    avgSeasonLossMonth,
    monthlyExpenseRise,
    inflationLoss,
    totalUdhariLoss,
    stockPriceRiseMonth,

    // Udhari detail (for display in S1)
    idealUdhari,
    effectiveUdhari,
    excessUdhari,
    excessCreditDays,
    udhariProfitLoss,
    udhariInterestLoss,
    part1Profit, part1Interest,
    part2Profit, part2Interest,

    monthlyCoD,
    dailyCoD:    monthlyCoD / 30,
    weeklyCoD:   monthlyCoD * 7 / 30,
    quarterlyCoD: monthlyCoD * 3,
    annualCoD:   monthlyCoD * 12,
  }
}

// ─── ROI ────────────────────────────────────────────────────────────────────
// Formula source: ROI sheet B2:B48

export function calculateROI(inp) {
  const {
    monthlySales, profitMargin, monthlyStockPurchase, stockRotationDays,
    loanAmount, tenureMonths, interestRate,
    lostCustomersPct, avgBillValue,
    seasonUplift, seasonMonths,
    bulkDiscount, schemeDiscount, cashDiscount,
  } = inp

  const pf         = profitMargin / 100
  const cycles     = 365 / stockRotationDays                              // B6
  const totalDisc  = (bulkDiscount + schemeDiscount + cashDiscount) / 100
  const normalMths = 12 - seasonMonths                                    // B2: 9

  // Only the business portion of the loan buys stock → ROI on business share only
  const stockFromLoan = loanAmount * ((inp.businessLoanPct ?? 100) / 100) // business portion

  // Extra monthly sales from loan stock (30% realization)
  const normalSalesRise  = ((stockFromLoan * cycles) / 12) * 0.30
  const seasonSalesRise  = normalSalesRise * (1 + seasonUplift / 100)

  // Profit from extra sales
  const normalProfitYear = normalSalesRise * pf * normalMths
  const seasonProfitYear = seasonSalesRise * pf * seasonMonths
  const avgMonthlyProfit = (normalProfitYear + seasonProfitYear) / 12

  // Supplier discount recovered — same formula as missedDiscount in COD
  const discountRecovered = (stockFromLoan * 0.60 * totalDisc * cycles) / 12

  // Competitor sales recovered (same formula as COD)
  const lostPerDay          = (inp.dailyWalkins ?? 0) * ((lostCustomersPct ?? 0) / 100)
  const competitorRecovered = lostPerDay * avgBillValue * 30 * pf * 0.40

  // Cash cycle improvement — 7% of existing monthly profit
  const oldProfit     = monthlySales * pf
  const cashCycleGain = oldProfit * 0.07

  // ─ Total monthly gain ─
  const totalMonthlyGain = avgMonthlyProfit + discountRecovered + competitorRecovered + cashCycleGain // B45

  // ─ Loan cost ─
  const emiAmount         = calcEMI(loanAmount, interestRate, tenureMonths) // B46
  const totalRepayment    = emiAmount * tenureMonths                        // B47
  const totalInterest     = totalRepayment - loanAmount

  // Business share of repayment (ROI should only measure return on business investment)
  const bizPct            = (inp.businessLoanPct ?? 100) / 100
  const bizRepayment      = totalRepayment * bizPct

  // ─ ROI metrics ─
  const annualROIPct   = bizRepayment > 0 ? (totalMonthlyGain * 12 / bizRepayment) * 100 : 0
  const paybackMonths  = totalMonthlyGain > 0 ? totalRepayment / totalMonthlyGain : 0
  const netGainTenure  = (totalMonthlyGain * tenureMonths) - totalRepayment

  return {
    normalSalesRise, seasonSalesRise,
    avgMonthlyProfit,
    discountRecovered,
    competitorRecovered,
    cashCycleGain,
    totalMonthlyGain,
    emiAmount,
    totalRepayment,
    bizRepayment,
    totalInterest,
    annualROIPct,
    paybackMonths,
    netGainTenure,
    dailyEMI: emiAmount / 30,
  }
}

// ─── Customer Score ──────────────────────────────────────────────────────────

export function calculateScore(inp, roi) {
  let score = 0
  const mthlyProfit = inp.monthlySales * inp.profitMargin / 100

  // Business age (20 pts)
  const ageMap = { '<1': 5, '1-2': 8, '2-3': 12, '3-5': 16, '5+': 20 }
  score += ageMap[inp.businessAge] ?? 10

  // Profit margin (20 pts)
  score += inp.profitMargin > 30 ? 20 : inp.profitMargin > 20 ? 15 : inp.profitMargin > 10 ? 10 : 5

  // Existing EMI burden (20 pts)
  const emiBurden = inp.existingLoan && mthlyProfit > 0 ? inp.existingEMI / mthlyProfit : 0
  score += emiBurden > 0.5 ? 0 : emiBurden > 0.3 ? 8 : 20

  // ROI (20 pts)
  score += roi.annualROIPct > 200 ? 20 : roi.annualROIPct > 100 ? 15 : roi.annualROIPct > 50 ? 10 : 5

  // Problem clarity (20 pts)
  const pc = inp.problems.length
  score += pc >= 3 ? 20 : pc >= 2 ? 15 : pc >= 1 ? 10 : 0

  const flags = {
    highEMI:         inp.existingLoan && emiBurden > 0.4,
    lowROI:          roi.annualROIPct < 50,
    cashFlowRisk:    roi.paybackMonths > inp.tenureMonths * 0.8,
    thinMargin:      inp.profitMargin < 10,
    strongGrowth:    roi.annualROIPct > 200,
    quickPayback:    roi.paybackMonths < inp.tenureMonths / 2,
    udhariIncreasing: inp.udhariIncreasing === true,
  }

  const band =
    score >= 80 ? { label: 'Excellent', color: '#16A34A', bg: '#DCFCE7', emoji: '⭐' } :
    score >= 60 ? { label: 'Good',      color: '#2563EB', bg: '#DBEAFE', emoji: '✅' } :
    score >= 40 ? { label: 'Fair',      color: '#D97706', bg: '#FEF3C7', emoji: '🟡' } :
                  { label: 'Review',    color: '#DC2626', bg: '#FEE2E2', emoji: '⚠️' }

  return { score, band, flags, emiBurden }
}

// ─── Loan Recommendation ─────────────────────────────────────────────────────

export function calculateRecommendation(inp, roi) {
  const mthlyProfit = inp.monthlySales * inp.profitMargin / 100

  const capTurnover  = inp.monthlySales * 3        // 3× monthly sales
  const capRepayment = mthlyProfit * 18            // 18 months of profit
  const capMax       = 2100000                     // ₹21L max (user spec)
  const capMin       = 200000                      // ₹2L min (user spec)

  const raw     = Math.min(capTurnover, capRepayment, inp.loanAmount, capMax)
  const recLoan = Math.max(raw, capMin)

  const tenureRaw = Math.max(roi.paybackMonths * 1.5, 12)
  const recTenure = Math.min(Math.round(tenureRaw / 6) * 6, 36)  // round to nearest 6M

  const recEMI = calcEMI(recLoan, inp.interestRate, recTenure)
  const recTotalRepay = recEMI * recTenure
  const recNetGain    = (roi.totalMonthlyGain * recTenure) - recTotalRepay

  return { recLoan, recTenure, recEMI, recTotalRepay, recNetGain }
}
