import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getCurrentUser, getLatestResponseEvent } from '../lib/db/dashboard'
import { calculateROI, calculateCOD, calcEMI } from '../logic/calculations'
import { PROBLEMS } from '../logic/problems'

// Flat tag → label map for sub-problems
const SUB_LABEL = {}
PROBLEMS.forEach(p => p.subProblems.forEach(sp => { SUB_LABEL[sp.tag] = sp.label }))

const STAGE_LABEL = {
  visited:         { label: 'Visited',    color: 'bg-indigo-100 text-indigo-700'   },
  pain_identified: { label: 'Pain Done',  color: 'bg-purple-100 text-purple-700'   },
  roi_shown:       { label: 'ROI Shown',  color: 'bg-blue-100 text-blue-700'       },
  login_started:   { label: 'Login Done', color: 'bg-green-100 text-green-700'     },
  approved:        { label: 'Approved',   color: 'bg-emerald-100 text-emerald-700' },
  disbursed:       { label: 'Disbursed',  color: 'bg-teal-100 text-teal-700'       },
}

const ROI_STAGES = new Set(['roi_shown', 'login_started', 'approved', 'disbursed'])

function fmt(n) {
  if (!n || n <= 0) return null
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, emoji, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <p className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">
          {emoji} {title}
        </p>
        <span className="text-slate-400 text-sm font-bold">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">{children}</div>}
    </div>
  )
}

function Row({ label, value, valueClass = 'text-slate-700' }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-bold text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs font-semibold flex-1 ${valueClass}`}>{value}</span>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function S_Workspace() {
  const {
    activeCustomer,
    inputs,
    clearActiveCustomer,
    openQuickCreate,
    openCustomerFormForEdit,
    openPainDiscovery,
    setMainScreen,
    openDashboard,
  } = useApp()

  const salesman    = getCurrentUser()
  const [response, setResponse] = useState(null)

  useEffect(() => {
    if (!activeCustomer?.id) return
    getLatestResponseEvent(activeCustomer.id)
      .then(r => { if (r) setResponse(r) })
      .catch(() => {})
  }, [activeCustomer?.id])

  if (!activeCustomer) {
    return (
      <div className="phone-shell flex flex-col items-center justify-center bg-slate-50" style={{ minHeight: '100dvh' }}>
        <p className="text-slate-400 text-sm">Koi active customer nahi.</p>
        <button onClick={() => setMainScreen('home')} className="mt-4 text-indigo-600 font-bold text-sm">
          ← Home Pe Jao
        </button>
      </div>
    )
  }

  const stage        = STAGE_LABEL[activeCustomer.stage] || STAGE_LABEL.visited
  const engagementDone = !!activeCustomer.engagementFilled
  const painDone       = !!activeCustomer.painFilled
  const roiDone        = !!activeCustomer.roiFilled || ROI_STAGES.has(activeCustomer.stage)
  const pain           = activeCustomer.painData || {}

  // ── Derived values ────────────────────────────────────────────────────────
  const primaryProblemLabel = pain.primaryProblem
    ? (PROBLEMS.find(p => p.tag === pain.primaryProblem)?.title || pain.primaryProblem)
    : pain.q1Other || null

  const urgencyLabel = pain.priority === 'abhi' ? '⚡ Abhi Solve Karna Hai'
                     : pain.priority === 'baad'  ? '🕐 Thoda Wait Karunga'
                     : null

  const capitalLabel = pain.capitalNeeded === 'haan' ? '✅ Haan'
                     : pain.capitalNeeded === 'nahi'  ? '❌ Nahi'
                     : null

  const responseLabel = response === 'interested'     ? '🟢 Interested'
                      : response === 'thinking'        ? '🟡 Soch Raha'
                      : response === 'not_interested'  ? '🔴 Nahi'
                      : null

  // Intent derived from stage + urgency + response
  const intentScore =
    (response === 'interested'                                        ? 3 : 0) +
    (response === 'thinking'                                          ? 1 : 0) +
    (response === 'not_interested'                                    ? -2 : 0) +
    (pain.priority === 'abhi'                                         ? 2 : 0) +
    (['login_started','approved','disbursed'].includes(activeCustomer.stage) ? 2 : 0) +
    (activeCustomer.stage === 'roi_shown'                             ? 1 : 0)
  const intentLabel = intentScore >= 4 ? '🔥 High'
                    : intentScore >= 1  ? '🟡 Medium'
                    :                    '❄️ Low'

  // ROI/COD numbers from inputs
  let roiGain = null, codLoss = null, emiAmt = null
  if (inputs.loanAmount > 0 && inputs.tenureMonths > 0) {
    try {
      const roi = calculateROI(inputs)
      const cod = calculateCOD(inputs)
      roiGain = Math.round(roi.totalMonthlyGain)
      codLoss = Math.round(cod.monthlyCoD)
      emiAmt  = Math.round(roi.emiAmount)
    } catch (_) {}
  }

  const roiLine = roiGain
    ? `+${fmt(roiGain)}/month | EMI: ${fmt(emiAmt)}`
    : null

  function openEngagementForm() {
    openCustomerFormForEdit({
      id:                  activeCustomer.visitEventId || null,
      customerId:          activeCustomer.id,
      shopName:            activeCustomer.shopName  || '',
      ownerName:           activeCustomer.ownerName || '',
      mobile:              activeCustomer.mobile    || '',
      city:                activeCustomer.city      || '',
      market:              activeCustomer.market    || '',
      bizTypes:            activeCustomer.bizTypes            || [],
      bizTypeOther:        activeCustomer.bizTypeOther        || '',
      seasons:             activeCustomer.seasons             || [],
      seasonOther:         activeCustomer.seasonOther         || '',
      peakMonths:          activeCustomer.peakMonths          || [],
      offSeasonSales:      activeCustomer.offSeasonSales      || '',
      offSeasonSalesOther: activeCustomer.offSeasonSalesOther || '',
      investmentTiming:    activeCustomer.investmentTiming    || '',
      prepTime:            activeCustomer.prepTime            || '',
      prepTimeOther:       activeCustomer.prepTimeOther       || '',
      problems:            activeCustomer.problems            || [],
      decisionDelay:       activeCustomer.decisionDelay       || '',
      mindset:             activeCustomer.mindset             || [],
      mindsetOther:        activeCustomer.mindsetOther        || '',
      photoUrls:           activeCustomer.photoUrls           || [],
    })
  }

  const initial = (activeCustomer.shopName || '?').charAt(0).toUpperCase()

  // ── Business profile helpers ──────────────────────────────────────────────
  const bizTypes   = (activeCustomer.bizTypes || []).filter(v => v !== '__other__')
  const bizDisplay = [...bizTypes, activeCustomer.bizTypeOther].filter(Boolean).join(', ')
  const seasons    = (activeCustomer.seasons || []).filter(s => s !== '__other__')
  const seasonDisplay = [...seasons, activeCustomer.seasonOther].filter(Boolean).join(', ')

  // ── Affordability ─────────────────────────────────────────────────────────
  let bizAffordability = null
  if (emiAmt && inputs.loanAmount > 0) {
    const bizPct       = inputs.businessLoanPct ?? 100
    const businessEMI  = emiAmt * bizPct / 100
    const grossMargin  = inputs.monthlySales * (inputs.profitMargin ?? 0) / 100
    const fixedExp     = (inputs.rent ?? 0) + (inputs.electricity ?? 0) + (inputs.salaries ?? 0)
    const netBiz       = grossMargin - fixedExp
    const fullIncome   = Math.max(1, netBiz + (inputs.familyIncome ?? 0))
    const pct          = (businessEMI / fullIncome) * 100
    bizAffordability   = pct < 30 ? `🟢 High (${Math.round(pct)}%)`
                       : pct < 50 ? `🟡 Medium (${Math.round(pct)}%)`
                       :            `🔴 Low (${Math.round(pct)}%)`
  }

  return (
    <div className="phone-shell flex flex-col bg-slate-50" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-5 px-5 flex-shrink-0">
        <button
          onClick={() => setMainScreen('home')}
          className="text-indigo-300 text-xs font-semibold mb-3 flex items-center gap-1"
        >
          ← Home
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold leading-tight truncate">{activeCustomer.shopName}</p>
            {activeCustomer.ownerName && (
              <p className="text-xs text-indigo-300 truncate">{activeCustomer.ownerName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.color}`}>
                {stage.label}
              </span>
              {activeCustomer.city && (
                <span className="text-[10px] text-indigo-300">{activeCustomer.city}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 space-y-3">

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Is Customer Pe Kaam Karo</p>

        <button
          onClick={openEngagementForm}
          className={`w-full rounded-2xl px-4 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left border
            ${engagementDone ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}
        >
          <span className="text-2xl flex-shrink-0">{engagementDone ? '✅' : '📝'}</span>
          <div className="flex-1">
            <p className={`text-sm font-extrabold ${engagementDone ? 'text-green-700' : 'text-slate-800'}`}>
              Engagement Form
              {engagementDone && <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Done ✓</span>}
            </p>
            <p className={`text-xs mt-0.5 ${engagementDone ? 'text-green-600' : 'text-slate-500'}`}>
              {engagementDone ? 'Vyapar ki jankari save hui — tap to edit' : 'Vyapar ki jankari, photos, details'}
            </p>
          </div>
          <span className="text-slate-300 text-lg flex-shrink-0">›</span>
        </button>

        <button
          onClick={openPainDiscovery}
          className={`w-full rounded-2xl px-4 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left border
            ${painDone ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}
        >
          <span className="text-2xl flex-shrink-0">{painDone ? '✅' : '🔍'}</span>
          <div className="flex-1">
            <p className={`text-sm font-extrabold ${painDone ? 'text-green-700' : 'text-slate-800'}`}>
              Pain Discovery
              {painDone && <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Done ✓</span>}
            </p>
            <p className={`text-xs mt-0.5 ${painDone ? 'text-green-600' : 'text-slate-500'}`}>
              {painDone ? 'Pain data save hua — tap to add more' : 'Customer ke problems samjho'}
            </p>
          </div>
          <span className="text-slate-300 text-lg flex-shrink-0">›</span>
        </button>

        <button
          onClick={() => setMainScreen('roi')}
          className={`w-full rounded-2xl px-4 py-4 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-all text-left border
            ${roiDone ? 'bg-green-50 border-green-200 shadow-green-100' : 'bg-indigo-600 border-indigo-600 shadow-indigo-200'}`}
        >
          <span className="text-2xl flex-shrink-0">{roiDone ? '✅' : '📊'}</span>
          <div className="flex-1">
            <p className={`text-sm font-extrabold ${roiDone ? 'text-green-700' : 'text-white'}`}>
              ROI / COD Calculator
              {roiDone && <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Done ✓</span>}
            </p>
            <p className={`text-xs mt-0.5 ${roiDone ? 'text-green-600' : 'text-indigo-200'}`}>
              {roiDone ? 'ROI dikhaya ja chuka hai — tap to redo' : 'Loan ka faida dikhao'}
            </p>
          </div>
          <span className={`text-lg flex-shrink-0 ${roiDone ? 'text-slate-300' : 'text-indigo-300'}`}>›</span>
        </button>

        {/* ── Top Insights ──────────────────────────────────────────────── */}
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 pt-2">Customer Insights</p>

        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">⚡ Top Insights</p>

          <Row label="Problem"  value={primaryProblemLabel} />
          <Row label="Urgency"  value={urgencyLabel} valueClass={pain.priority === 'abhi' ? 'text-red-600' : 'text-amber-600'} />
          <Row label="Stage"    value={stage.label} />
          <Row label="Capital"  value={capitalLabel} />
          <Row label="ROI"      value={roiLine} valueClass="text-green-700" />
          <Row label="Response" value={responseLabel} />
          <Row label="Intent"   value={intentLabel} />

          {!primaryProblemLabel && !urgencyLabel && !roiLine && !responseLabel && (
            <p className="text-xs text-slate-400 italic text-center py-1">
              Pehle engagement aur pain form bharo — insights yahan aayenge
            </p>
          )}
        </div>

        {/* ── Collapsible sections ──────────────────────────────────────── */}

        {/* 1. Business Profile */}
        {(bizDisplay || seasonDisplay || activeCustomer.market) && (
          <Section title="Business Profile" emoji="🏪">
            <Row label="Business"   value={bizDisplay} />
            <Row label="Market"     value={activeCustomer.market} />
            <Row label="City"       value={activeCustomer.city} />
            <Row label="Season"     value={seasonDisplay} />
            {(activeCustomer.peakMonths || []).length > 0 && (
              <Row label="Peak"     value={activeCustomer.peakMonths.join(', ')} />
            )}
            <Row label="Off Season" value={activeCustomer.offSeasonSales === 'other' ? activeCustomer.offSeasonSalesOther : activeCustomer.offSeasonSales} />
            <Row label="Inv. Timing" value={activeCustomer.investmentTiming} />
            <Row label="Prep Time"  value={activeCustomer.prepTime === 'other' ? activeCustomer.prepTimeOther : activeCustomer.prepTime} />
          </Section>
        )}

        {/* 2. Full Problem Layer */}
        {(primaryProblemLabel || (pain.subProblems || []).length > 0) && (
          <Section title="Full Problem Layer" emoji="🚨">
            <Row label="Primary"   value={primaryProblemLabel} />
            {(pain.subProblems || []).length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[11px] font-bold text-slate-400 w-24 flex-shrink-0 pt-0.5">Sub-problems</span>
                <div className="flex-1 space-y-0.5">
                  {pain.subProblems.map((tag, i) => (
                    <p key={i} className="text-xs font-semibold text-slate-700">• {SUB_LABEL[tag] || tag}</p>
                  ))}
                </div>
              </div>
            )}
            {pain.notesByQ && Object.keys(pain.notesByQ).length > 0 && (
              <div className="pt-1 border-t border-slate-100 space-y-1">
                {Object.entries(pain.notesByQ).map(([q, note]) => note ? (
                  <p key={q} className="text-[11px] text-slate-500 italic">Q{q}: {note}</p>
                ) : null)}
              </div>
            )}
          </Section>
        )}

        {/* 3. Urgency & Behavior */}
        {(urgencyLabel || pain.problemYears || pain.problemMonths || activeCustomer.decisionDelay || (activeCustomer.mindset || []).length > 0) && (
          <Section title="Urgency & Behavior" emoji="⚡">
            <Row label="Urgency"   value={urgencyLabel} valueClass={pain.priority === 'abhi' ? 'text-red-600' : 'text-amber-600'} />
            {(pain.problemYears || pain.problemMonths) && (
              <Row label="Problem since"
                value={[pain.problemYears ? `${pain.problemYears} saal` : '', pain.problemMonths ? `${pain.problemMonths} mahine` : ''].filter(Boolean).join(' ')}
              />
            )}
            <Row label="Delay reason" value={activeCustomer.decisionDelay} />
            {(activeCustomer.mindset || []).length > 0 && (
              <Row label="Business focus" value={activeCustomer.mindset[0]} />
            )}
          </Section>
        )}

        {/* 4. Capital Details */}
        {(capitalLabel || activeCustomer.investmentTiming || seasonDisplay) && (
          <Section title="Capital Details" emoji="💰">
            <Row label="Capital?"     value={capitalLabel} />
            <Row label="Inv. Timing"  value={activeCustomer.investmentTiming} />
            <Row label="Season"       value={seasonDisplay} />
            {(activeCustomer.peakMonths || []).length > 0 && (
              <Row label="Peak"       value={activeCustomer.peakMonths.join(', ')} />
            )}
            <Row label="Prep Time"    value={activeCustomer.prepTime === 'other' ? activeCustomer.prepTimeOther : activeCustomer.prepTime} />
          </Section>
        )}

        {/* 5. ROI / COD Full Details */}
        {roiDone && (
          <Section title="ROI / COD Full Details" emoji="📊">
            <Row label="Loan"          value={fmt(inputs.loanAmount)} />
            <Row label="Tenure"        value={inputs.tenureMonths ? `${inputs.tenureMonths} mahine` : null} />
            <Row label="EMI"           value={fmt(emiAmt)} />
            <Row label="Monthly Gain"  value={roiGain ? `+${fmt(roiGain)}/month` : null} valueClass="text-green-700" />
            <Row label="Monthly Loss"  value={codLoss ? `−${fmt(codLoss)}/month` : null} valueClass="text-red-600" />
            <Row label="Affordability" value={bizAffordability} />
          </Section>
        )}

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-100 px-4 py-3 z-30">
        <div className="flex gap-3">
          <button
            onClick={openDashboard}
            className="flex-1 py-3 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-bold active:bg-indigo-50 transition-all"
          >
            🔄 Lead Badlo
          </button>
          <button
            onClick={() => { clearActiveCustomer(); openQuickCreate() }}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-95 transition-all shadow-lg shadow-indigo-200"
          >
            + Nayi Lead
          </button>
        </div>
      </div>

    </div>
  )
}
