/**
 * Intent scoring — derived from signals collected across all forms.
 * Never store intent directly; always recompute from latest data.
 */

export function computeIntent(signals = {}) {
  let score = 0
  if (signals.urgency         === 'now')         score += 3
  if (signals.capital_needed  === 'yes')          score += 2
  if (signals.delayed_due_to_money === 'yes')     score += 2
  if (signals.business_focus  === 'growth')       score += 1
  if (signals.pain_response   === 'interested')   score += 2
  if (signals.roi_response    === 'interested')   score += 3
  if (signals.roi_response    === 'thinking')     score += 1
  if (signals.stage           === 'login_started') score += 5
  if (signals.stage           === 'roi_shown')    score += 1
  if (score >= 8) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  return 'LOW'
}

export function computeTags(signals = {}, topProblems = []) {
  const tags = []
  const problems = topProblems.map(p => p.toLowerCase())
  if (problems.some(p => p.includes('stock') || p.includes('स्टॉक')))               tags.push('stock_problem')
  if (problems.some(p => p.includes('cash') || p.includes('रोज़') || p.includes('उधार'))) tags.push('cash_flow_issue')
  if (signals.season_dependency === 'high')                                           tags.push('seasonal_high_dependency')
  if (computeIntent(signals) === 'HIGH')                                              tags.push('high_intent')
  if (signals.delayed_due_to_money === 'yes')                                        tags.push('delayed_due_to_money')
  if (signals.business_focus === 'growth')                                           tags.push('growth_customer')
  return tags
}

// Fields checked for profile completion
const COMPLETION_FIELDS = [
  { key: 'shopName',   label: 'Shop Name' },
  { key: 'ownerName',  label: 'Owner Name' },
  { key: 'mobile',     label: 'Mobile' },
  { key: 'city',       label: 'City' },
  { key: 'bizType',    label: 'Business Type' },
  { key: 'season',     label: 'Season' },
  { key: 'problem',    label: 'Problem' },
  { key: 'urgency',    label: 'Urgency' },
  { key: 'capital',    label: 'Capital Need' },
  { key: 'roiShown',   label: 'ROI Shown' },
]

export function computeProfileCompletion(customer, visitData = {}, painData = {}) {
  const checks = [
    !!(customer.shopName  || customer.shop_name),
    !!(customer.ownerName || customer.owner_name),
    !!(customer.mobile),
    !!(customer.city || customer.area),
    !!(customer.businessType || customer.business_type || (visitData.bizTypes || []).filter(v => v !== '__other__').length > 0),
    !!((visitData.seasons || []).length > 0 || visitData.seasonOther),
    !!((visitData.problems || []).length > 0 || painData.primaryProblem),
    !!(painData.urgency || painData.priority),
    !!(painData.capitalNeeded),
    !!(customer.stage === 'roi_shown' || customer.stage === 'login_started'),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export const INTENT_COLORS = {
  HIGH:   { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500'  },
  MEDIUM: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500'  },
  LOW:    { bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
}
