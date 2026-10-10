/**
 * Qualification questions asked once a customer says "Interested".
 *
 * The agent only records the answers and submits them. A manager/admin reads
 * them in the admin console and decides: Qualified (lead_qualified event →
 * stage Qualified, migration 015), Nurture, or Not Qualified. Nothing here
 * scores or judges the lead.
 *
 * Answers are stored as their display labels in the loan_requirement event,
 * so the manager reads exactly what the agent tapped.
 */

export const LOAN_PURPOSES   = ['Stock', 'Supplier payment', 'Dukaan upgrade', 'Machine / equipment', 'Purana loan chukana', 'Ghar ka kharch', 'Other']
export const NEEDED_BY       = ['15 din me', '1-1.5 mahine me', 'Baad me']
export const DECISION_MAKERS = ['Main khud', 'Ghar me puchna hai']
export const CO_APPLICANTS   = ['Patni / Pati', 'Pita', 'Bhai', 'Beta', 'Koi nahi']
export const SHOP_AGES       = ['1 saal se kam', '1-2 saal', '2-5 saal', '5+ saal']
export const PROPERTY_TYPES  = ['Ghar', 'Dukaan', 'Zameen / Plot', 'Flat']

export const EMPTY_LOAN_REQ = {
  loanRequired:    '',
  loanPurpose:     '',
  neededBy:        '',
  familyIncome:    '',
  hasExistingLoan: null,
  totalLoanAmount: '',
  totalEmi:        '',
  decisionMaker:   '',
  coApplicant:     '',
  shopAge:         '',
  pastBounce:      null,
  hasProperty:     null,
  propertyTypes:   [],
  consent:         false,
  submittedAt:     null,
}

const toNum = v => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0

/**
 * Questions still unanswered, in the order they are asked. Used to tell the
 * agent what is left and to show the manager the gaps. Optional detail
 * (co-applicant, property type, existing loan amounts) is not listed.
 */
export function missingQualificationAnswers(r = {}) {
  const missing = []
  if (!toNum(r.loanRequired))      missing.push('Loan amount')
  if (!r.loanPurpose)              missing.push('Loan kis kaam ke liye')
  if (!r.neededBy)                 missing.push('Kab tak chahiye')
  if (!toNum(r.familyIncome))      missing.push('Ghar ki total income')
  if (r.hasExistingLoan == null)   missing.push('Existing loan')
  if (!r.decisionMaker)            missing.push('Faisla kaun lega')
  if (!r.shopAge)                  missing.push('Dukaan kitni purani')
  if (r.pastBounce == null)        missing.push('EMI bounce')
  if (r.hasProperty == null)       missing.push('Property')
  return missing
}

/** True when the agent may submit: a loan amount and the customer's consent. */
export function canSubmitQualification(r = {}) {
  return toNum(r.loanRequired) > 0 && r.consent === true
}

/** The loan_requirement event payload: numbers cleaned, dependent fields cleared. */
export function buildQualificationPayload(r = {}, now = new Date()) {
  const hasLoan     = r.hasExistingLoan === true
  const hasProperty = r.hasProperty === true
  return {
    loanRequired:    toNum(r.loanRequired),
    loanPurpose:     r.loanPurpose || null,
    neededBy:        r.neededBy || null,
    familyIncome:    toNum(r.familyIncome),
    hasExistingLoan: r.hasExistingLoan ?? null,
    totalLoanAmount: hasLoan ? toNum(r.totalLoanAmount) : 0,
    totalEmi:        hasLoan ? toNum(r.totalEmi)        : 0,
    decisionMaker:   r.decisionMaker || null,
    coApplicant:     r.coApplicant || null,
    shopAge:         r.shopAge || null,
    pastBounce:      r.pastBounce ?? null,
    hasProperty:     r.hasProperty ?? null,
    propertyTypes:   hasProperty && Array.isArray(r.propertyTypes) ? r.propertyTypes : [],
    consent:         r.consent === true,
    submittedAt:     now.toISOString(),
  }
}

/** "5 lakh", "1.5 lakh", "85,000": an amount the way it is said aloud. */
export function lakhLabel(value) {
  const n = toNum(value)
  if (!n) return ''
  if (n >= 100000) {
    const lakh = n / 100000
    return `${Number.isInteger(lakh) ? lakh : lakh.toFixed(2).replace(/0$/, '')} lakh`
  }
  return n.toLocaleString('en-IN')
}

/** Manager-facing rows for the submitted answers (label, value), "—" when blank. */
export function qualificationRows(d = {}) {
  const yesNo = v => (v === true ? 'Haan' : v === false ? 'Nahi' : '—')
  const rupees = v => (toNum(v) ? `₹${toNum(v).toLocaleString('en-IN')}` : '—')
  return [
    ['Loan amount',       rupees(d.loanRequired)],
    ['Kis kaam ke liye',  d.loanPurpose || '—'],
    ['Kab tak chahiye',   d.neededBy || '—'],
    ['Ghar ki income',    toNum(d.familyIncome) ? `${rupees(d.familyIncome)}/mahina` : '—'],
    ['Existing loan',     d.hasExistingLoan === true
                            ? `Haan · ${rupees(d.totalLoanAmount)} · EMI ${rupees(d.totalEmi)}/mahina`
                            : yesNo(d.hasExistingLoan)],
    ['Faisla',            d.decisionMaker || '—'],
    ['Co-applicant',      d.coApplicant || '—'],
    ['Dukaan kitni purani', d.shopAge || '—'],
    ['EMI kabhi bounce',  yesNo(d.pastBounce)],
    ['Property',          d.hasProperty === true
                            ? `Haan${d.propertyTypes?.length ? ` · ${d.propertyTypes.join(', ')}` : ''}`
                            : yesNo(d.hasProperty)],
    ['Consent',           d.consent ? 'Haan' : 'Nahi'],
  ]
}
