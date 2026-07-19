import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { getCurrentUser, getLatestResponseEvent, saveCustomerResponse } from '../lib/db/dashboard'
import { createReminder, getRemindersForCustomer, completeReminder, updateReminder, deleteReminder, quickDueDate } from '../lib/db/reminders'
import { addNote, getNotes, getLoanRequirement, saveLoanRequirement } from '../lib/db/events'
import { calculateROI, calculateCOD, calcEMI } from '../logic/calculations'
import { PROBLEMS } from '../logic/problems'

// Flat tag → label map for sub-problems
const SUB_LABEL = {}
PROBLEMS.forEach(p => p.subProblems.forEach(sp => { SUB_LABEL[sp.tag] = sp.label }))

const STAGE_LABEL = {
  visited:         { label: 'Visited',    color: 'bg-brand-100 text-brand-700'   },
  pain_identified: { label: 'Pain Done',  color: 'bg-purple-100 text-purple-700'   },
  roi_shown:       { label: 'ROI Shown',  color: 'bg-blue-100 text-blue-700'       },
  login_started:   { label: 'Login Done', color: 'bg-green-100 text-green-700'     },
  approved:        { label: 'Approved',   color: 'bg-emerald-100 text-emerald-700' },
  disbursed:       { label: 'Disbursed',  color: 'bg-teal-100 text-teal-700'       },
}

const ROI_STAGES = new Set(['roi_shown', 'login_started', 'approved', 'disbursed'])

const EMPTY_LOAN_REQ = {
  loanRequired: '', familyIncome: '', hasExistingLoan: null,
  totalLoanAmount: '', totalEmi: '',
}

// Digits only — amounts and tenures are always whole numbers here
const digits = v => String(v ?? '').replace(/[^0-9]/g, '')
const num    = v => parseInt(digits(v), 10) || 0

// Voice dictation is Chrome/Edge/Android only — hide the mic where unsupported
const speechSupported = typeof window !== 'undefined'
  && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

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
    profile,
    update,
  } = useApp()

  const salesman = getCurrentUser()
  const [response,      setResponse]      = useState(null)
  const [responseSaving, setResponseSaving] = useState(false)

  // ── Follow-up reminder ────────────────────────────────────────────────────
  const [openReminder,   setOpenReminder]   = useState(null)
  const [doneReminders,  setDoneReminders]  = useState([])
  const [reminderSaving, setReminderSaving] = useState(false)
  const [dueAtInput,     setDueAtInput]     = useState('')
  const [reminderNote,   setReminderNote]   = useState('')
  const [rescheduling,   setRescheduling]   = useState(false)
  const [confirmDeleteReminder, setConfirmDeleteReminder] = useState(false)
  const [completing,     setCompleting]     = useState(false)
  const [completionNote, setCompletionNote] = useState('')

  // ── Loan requirement (captured when customer is Interested) ───────────────
  const [loanReq,       setLoanReq]       = useState(EMPTY_LOAN_REQ)
  const [loanReqSaving, setLoanReqSaving] = useState(false)
  const [loanReqSaved,  setLoanReqSaved]  = useState(false)

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes,      setNotes]      = useState([])
  const [noteText,   setNoteText]   = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [listening,  setListening]  = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!activeCustomer?.id) return
    getLatestResponseEvent(activeCustomer.id)
      .then(r => { if (r) setResponse(r) })
      .catch(() => {})
    getRemindersForCustomer(activeCustomer.id)
      .then(list => {
        setOpenReminder(list.find(r => r.status === 'pending') || null)
        setDoneReminders(list.filter(r => r.status === 'done'))
      })
      .catch(() => {})
    getNotes(activeCustomer.id).then(setNotes).catch(() => {})
    getLoanRequirement(activeCustomer.id)
      .then(ev => {
        if (!ev?.data) return
        const d = ev.data
        // Older records stored a per-loan breakdown — roll it up into the totals
        const legacy = Array.isArray(d.existingLoans) ? d.existingLoans : null
        setLoanReq({
          ...EMPTY_LOAN_REQ,
          ...d,
          totalLoanAmount: d.totalLoanAmount ?? (legacy ? legacy.reduce((s, l) => s + (l.amount || 0), 0) || '' : ''),
          totalEmi:        d.totalEmi        ?? (legacy ? legacy.reduce((s, l) => s + (l.emi    || 0), 0) || '' : ''),
        })
      })
      .catch(() => {})
  }, [activeCustomer?.id])

  async function handleResponse(value) {
    if (responseSaving) return
    setResponse(value || null)
    if (!value) return
    setResponseSaving(true)
    try { await saveCustomerResponse(activeCustomer.id, value, salesman) } catch (_) {}
    setResponseSaving(false)
  }

  async function quickSetReminder(days) {
    if (reminderSaving) return
    setReminderSaving(true)
    try {
      const r = await createReminder(activeCustomer.id, quickDueDate(days), reminderNote, salesman, profile?.id)
      setOpenReminder(r)
      setReminderNote('')
    } catch (_) {} finally { setReminderSaving(false) }
  }

  async function handleSetReminder() {
    if (!dueAtInput || reminderSaving) return
    setReminderSaving(true)
    try {
      const r = await createReminder(activeCustomer.id, new Date(dueAtInput).toISOString(), reminderNote, salesman, profile?.id)
      setOpenReminder(r)
      setDueAtInput('')
      setReminderNote('')
    } catch (_) {} finally { setReminderSaving(false) }
  }

  // Completing requires an outcome note — what was discussed with the customer
  async function handleCompleteReminder() {
    if (reminderSaving || !openReminder || !completionNote.trim()) return
    setReminderSaving(true)
    try {
      const text = completionNote.trim()
      await completeReminder(openReminder.reminder_id, text)
      setDoneReminders(prev => [{
        ...openReminder,
        status:          'done',
        completed_at:    new Date().toISOString(),
        completion_note: text,
      }, ...prev])

      setOpenReminder(null); setRescheduling(false); setReminderNote(''); setDueAtInput('')
      setCompleting(false); setCompletionNote(''); setConfirmDeleteReminder(false)
    } catch (_) {} finally { setReminderSaving(false) }
  }

  async function handleDeleteReminder() {
    if (reminderSaving || !openReminder) return
    setReminderSaving(true)
    try {
      await deleteReminder(openReminder.reminder_id)
      setOpenReminder(null); setRescheduling(false); setReminderNote(''); setDueAtInput('')
      setConfirmDeleteReminder(false); setCompleting(false); setCompletionNote('')
    } catch (_) {} finally { setReminderSaving(false) }
  }

  // Open the edit/reschedule editor, prefilling the current note
  function openEditReminder() {
    setReminderNote(openReminder?.note || '')
    setDueAtInput('')
    setRescheduling(true)
    setConfirmDeleteReminder(false)
    setCompleting(false)
    setCompletionNote('')
  }

  // Save an edit: new date if a chip/custom date was chosen, else keep old date; note always updates
  async function saveReminderEdit(newDueIso) {
    if (reminderSaving || !openReminder) return
    setReminderSaving(true)
    try {
      const due_at = newDueIso || openReminder.due_at
      await updateReminder(openReminder.reminder_id, { due_at, note: reminderNote })
      setOpenReminder({ ...openReminder, due_at, note: reminderNote.trim() || null })
      setDueAtInput('')
      setRescheduling(false)
    } catch (_) {} finally { setReminderSaving(false) }
  }

  // ── Loan requirement handlers ─────────────────────────────────────────────
  function setLoanField(key, value) {
    setLoanReq(prev => ({ ...prev, [key]: value }))
    setLoanReqSaved(false)
  }

  async function handleSaveLoanReq() {
    if (loanReqSaving) return
    setLoanReqSaving(true)
    try {
      const hasLoan = loanReq.hasExistingLoan === true
      const payload = {
        loanRequired:    num(loanReq.loanRequired),
        familyIncome:    num(loanReq.familyIncome),
        hasExistingLoan: loanReq.hasExistingLoan,
        totalLoanAmount: hasLoan ? num(loanReq.totalLoanAmount) : 0,
        totalEmi:        hasLoan ? num(loanReq.totalEmi)        : 0,
      }
      await saveLoanRequirement(activeCustomer.id, payload, salesman)

      // Feed the ROI calculator — these stay editable there
      if (payload.loanRequired) update('loanAmount', payload.loanRequired)
      if (payload.familyIncome) update('familyIncome', payload.familyIncome)
      update('existingLoan', hasLoan)
      update('existingEMI', payload.totalEmi)

      setLoanReqSaved(true)
    } catch (_) {} finally { setLoanReqSaving(false) }
  }

  // ── Voice dictation for notes (browser Web Speech API, no dependency) ─────
  function toggleDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    if (listening) { recognitionRef.current?.stop(); return }

    const rec = new SR()
    rec.lang = 'hi-IN'          // Hindi/Hinglish — what salesmen actually speak
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = e => {
      const said = Array.from(e.results).map(r => r[0].transcript).join(' ').trim()
      if (said) setNoteText(prev => (prev ? prev.trimEnd() + ' ' : '') + said)
    }
    rec.onend   = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    try { rec.start() } catch (_) { setListening(false) }
  }

  // Stop any in-flight dictation when leaving the lead
  useEffect(() => () => { try { recognitionRef.current?.stop() } catch (_) {} }, [])

  async function handleAddNote() {
    if (!noteText.trim() || noteSaving) return
    setNoteSaving(true)
    try {
      const ev = await addNote(activeCustomer.id, noteText, salesman)
      setNotes(prev => [{ event_id: ev.event_id, data: ev.data, salesman_id: salesman, created_at: ev.created_at }, ...prev])
      setNoteText('')
    } catch (_) {} finally { setNoteSaving(false) }
  }

  if (!activeCustomer) {
    return (
      <div className="phone-shell flex flex-col items-center justify-center bg-white" style={{ minHeight: '100dvh' }}>
        <p className="text-slate-400 text-sm">Koi active customer nahi.</p>
        <button onClick={() => setMainScreen('home')} className="mt-4 text-brand-600 font-bold text-sm">
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
      decisionDelayDetail: activeCustomer.decisionDelayDetail || '',
      mindset:             activeCustomer.mindset             || [],
      mindsetOther:        activeCustomer.mindsetOther        || '',
      photoUrls:           activeCustomer.photoUrls           || [],
    })
  }

  const initial = (activeCustomer.shopName || '?').charAt(0).toUpperCase()

  // Follow-ups can only be deleted on the calendar day they were set — an
  // "undo my mis-tap" escape hatch, not a way to erase missed commitments.
  // Mirrors the isCreatedToday rule on lead deletion in S_Dashboard.
  const totalExistingLoan = num(loanReq.totalLoanAmount)
  const totalExistingEMI  = num(loanReq.totalEmi)

  const canDeleteReminder = openReminder?.created_at
    ? new Date(openReminder.created_at).toDateString() === new Date().toDateString()
    : false

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
    <div className="phone-shell flex flex-col bg-white" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0">
        <button
          onClick={() => setMainScreen('home')}
          className="text-brand-400 text-xs font-semibold mb-3 flex items-center gap-1"
        >
          ← Home
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold leading-tight truncate">{activeCustomer.shopName}</p>
            {activeCustomer.ownerName && (
              <p className="text-xs text-brand-400 truncate">{activeCustomer.ownerName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.color}`}>
                {stage.label}
              </span>
              {activeCustomer.city && (
                <span className="text-[10px] text-brand-400">{activeCustomer.city}</span>
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
            ${roiDone ? 'bg-green-50 border-green-200 shadow-green-100' : 'bg-brand-600 border-brand-600 shadow-brand-200'}`}
        >
          <span className="text-2xl flex-shrink-0">{roiDone ? '✅' : '📊'}</span>
          <div className="flex-1">
            <p className={`text-sm font-extrabold ${roiDone ? 'text-green-700' : 'text-white'}`}>
              ROI / COD Calculator
              {roiDone && <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Done ✓</span>}
            </p>
            <p className={`text-xs mt-0.5 ${roiDone ? 'text-green-600' : 'text-brand-200'}`}>
              {roiDone ? 'ROI dikhaya ja chuka hai — tap to redo' : 'Loan ka faida dikhao'}
            </p>
          </div>
          <span className={`text-lg flex-shrink-0 ${roiDone ? 'text-slate-300' : 'text-brand-400'}`}>›</span>
        </button>

        {/* ── Top Insights ──────────────────────────────────────────────── */}
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 pt-2">Customer Insights</p>

        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1">⚡ Top Insights</p>

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

        {/* ── Customer Response ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">💬 Customer Response</p>
          <select
            value={response || ''}
            onChange={e => handleResponse(e.target.value || null)}
            disabled={responseSaving}
            className={`w-full text-sm font-bold rounded-xl border px-3 py-2.5 outline-none appearance-none transition-colors
              ${response === 'interested'    ? 'bg-green-50 border-green-300 text-green-700'
              : response === 'thinking'       ? 'bg-amber-50 border-amber-300 text-amber-700'
              : response === 'not_interested' ? 'bg-red-50 border-red-300 text-red-600'
              :                                 'bg-white border-slate-200 text-slate-400'}`}
          >
            <option value=''>Response — Select</option>
            <option value='interested'>🟢 Interested</option>
            <option value='thinking'>🟡 Soch Raha</option>
            <option value='not_interested'>🔴 Nahi</option>
          </select>
        </div>

        {/* ── Loan Requirement (only when Interested) ─────────────────────── */}
        {response === 'interested' && (
          <Section title="Loan Requirement" emoji="💰" defaultOpen>
            {/* Total of all existing loans */}
            {totalExistingLoan > 0 && (
              <div className="mb-3 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Total Existing Loan</p>
                <p className="text-lg font-extrabold text-brand-700 leading-tight">₹{totalExistingLoan.toLocaleString('en-IN')}</p>
                {totalExistingEMI > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">Total EMI: ₹{totalExistingEMI.toLocaleString('en-IN')}/month</p>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              {/* Loan required */}
              <div>
                <label className="text-[11px] font-bold text-slate-500">💵 Kitna loan chahiye?</label>
                <input
                  type="tel"
                  value={loanReq.loanRequired}
                  onChange={e => setLoanField('loanRequired', digits(e.target.value))}
                  placeholder="500000"
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
              </div>

              {/* Family income */}
              <div>
                <label className="text-[11px] font-bold text-slate-500">👨‍👩‍👧 Total monthly family income</label>
                <input
                  type="tel"
                  value={loanReq.familyIncome}
                  onChange={e => setLoanField('familyIncome', digits(e.target.value))}
                  placeholder="50000"
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
              </div>

              {/* Existing loan yes/no */}
              <div>
                <label className="text-[11px] font-bold text-slate-500">🏦 Koi existing loan hai?</label>
                <div className="flex gap-2 mt-1">
                  {[['Haan', true], ['Nahi', false]].map(([label, val]) => (
                    <button
                      key={label}
                      onClick={() => setLoanField('hasExistingLoan', val)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold active:scale-95 transition-all
                        ${loanReq.hasExistingLoan === val
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing loan totals */}
              {loanReq.hasExistingLoan === true && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">Total loan amount</label>
                    <input
                      type="tel"
                      value={loanReq.totalLoanAmount}
                      onChange={e => setLoanField('totalLoanAmount', digits(e.target.value))}
                      placeholder="450000"
                      className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">Total EMI</label>
                    <input
                      type="tel"
                      value={loanReq.totalEmi}
                      onChange={e => setLoanField('totalEmi', digits(e.target.value))}
                      placeholder="12000"
                      className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveLoanReq}
                disabled={loanReqSaving}
                className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold active:scale-95 disabled:opacity-40"
              >
                {loanReqSaving ? 'Saving...' : loanReqSaved ? '✅ Saved' : 'Save Loan Details'}
              </button>
              {loanReqSaved && (
                <p className="text-[10px] text-green-600 text-center">
                  ROI calculator me bhi bhar diya — wahan edit kar sakte ho
                </p>
              )}
            </div>
          </Section>
        )}

        {/* ── Follow-up ─────────────────────────────────────────────────── */}
        <Section title="Follow-up" emoji="📅" defaultOpen>
          {openReminder && !rescheduling && (
            <>
              <div className="flex items-center gap-1.5 mb-2 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs">✅</span>
                <span className="text-[11px] font-bold text-green-700">Follow-up set ho gaya — reminder saved</span>
              </div>
              <Row
                label="Due"
                value={new Date(openReminder.due_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                valueClass={new Date(openReminder.due_at) < new Date() ? 'text-red-600 font-extrabold' : 'text-slate-700'}
              />
              <Row label="Note" value={openReminder.note} />

              {/* Completion form — outcome note is compulsory */}
              {completing ? (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-600">Customer se kya baat hui? *</p>
                  <textarea
                    value={completionNote}
                    onChange={e => setCompletionNote(e.target.value)}
                    placeholder="Jo customer ne kaha wo likho..."
                    rows={2}
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCompleteReminder}
                      disabled={!completionNote.trim() || reminderSaving}
                      className="flex-1 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 disabled:opacity-40"
                    >
                      {reminderSaving ? 'Saving...' : '✔️ Poora Hua'}
                    </button>
                    <button
                      onClick={() => { setCompleting(false); setCompletionNote('') }}
                      className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Note likhna zaroori hai — baad me kaam aayega
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={openEditReminder}
                      disabled={reminderSaving}
                      className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold active:scale-95 disabled:opacity-40"
                    >
                      ✏️ Edit / Reschedule
                    </button>
                    <button
                      onClick={() => { setCompleting(true); setConfirmDeleteReminder(false) }}
                      disabled={reminderSaving}
                      className="flex-1 py-2 rounded-xl border border-green-300 text-green-700 text-xs font-bold active:scale-95 disabled:opacity-40"
                    >
                      ✔️ Poora Hua
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center pt-1.5">
                    Jab follow-up ho jaaye tab "Poora Hua" dabao — reminder hat jaayega
                  </p>

                  {/* Same-day delete — undo a mis-tapped follow-up */}
                  {confirmDeleteReminder ? (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleDeleteReminder}
                        disabled={reminderSaving}
                        className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 disabled:opacity-60"
                      >
                        {reminderSaving ? 'Deleting...' : 'Haan, Delete Karo'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteReminder(false)}
                        className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl active:scale-95"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : canDeleteReminder && (
                    <button
                      onClick={() => setConfirmDeleteReminder(true)}
                      className="w-full text-[10px] font-semibold text-slate-400 active:text-red-500 pt-1"
                    >
                      🗑️ Galti se set ho gaya? Delete karo
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {openReminder && rescheduling && (
            <div className="space-y-2">
              <input
                type="text"
                value={reminderNote}
                onChange={e => setReminderNote(e.target.value)}
                placeholder="Follow-up me kya karna hai? (optional)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
              />
              <p className="text-[10px] font-bold text-slate-400">Date badlo — ek chuno (ya note save karo):</p>
              <div className="flex gap-1">
                {[['Kal', 1], ['3 din', 3], ['1 hafta', 7], ['15 din', 15], ['1 mahina', 30]].map(([label, days]) => (
                  <button
                    key={days}
                    onClick={() => saveReminderEdit(quickDueDate(days))}
                    disabled={reminderSaving}
                    className="flex-1 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold active:scale-95 disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={dueAtInput}
                  onChange={e => setDueAtInput(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
                <button
                  onClick={() => saveReminderEdit(dueAtInput ? new Date(dueAtInput).toISOString() : null)}
                  disabled={reminderSaving}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold disabled:opacity-40 active:scale-95"
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => { setRescheduling(false); setDueAtInput(''); setReminderNote('') }}
                className="w-full py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold active:scale-95"
              >
                Cancel
              </button>
            </div>
          )}

          {!openReminder && (
            <div className="space-y-2">
              <input
                type="text"
                value={reminderNote}
                onChange={e => setReminderNote(e.target.value)}
                placeholder="Follow-up me kya karna hai? (optional)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
              />
              <p className="text-[10px] font-bold text-slate-400">Kab? — ek chuno:</p>
              <div className="flex gap-1">
                {[['Kal', 1], ['3 din', 3], ['1 hafta', 7], ['15 din', 15], ['1 mahina', 30]].map(([label, days]) => (
                  <button
                    key={days}
                    onClick={() => quickSetReminder(days)}
                    disabled={reminderSaving}
                    className="flex-1 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold active:scale-95 disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={dueAtInput}
                  onChange={e => setDueAtInput(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
                <button
                  onClick={handleSetReminder}
                  disabled={!dueAtInput || reminderSaving}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold disabled:opacity-40 active:scale-95"
                >
                  Set
                </button>
              </div>
              {(reminderNote || dueAtInput) && (
                <button
                  onClick={() => { setReminderNote(''); setDueAtInput('') }}
                  className="w-full py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold active:scale-95"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {doneReminders.length > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">✔️ Poore ho chuke follow-ups ({doneReminders.length})</p>
              {doneReminders.map(r => (
                <div key={r.reminder_id} className="flex items-start gap-2">
                  <span className="text-green-500 text-[11px] mt-0.5 flex-shrink-0">✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">
                      {new Date(r.due_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      {r.note ? ` — ${r.note}` : ''}
                    </p>
                    {r.completed_at && (
                      <p className="text-[10px] text-green-600">Poora hua: {new Date(r.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    )}
                    {r.completion_note && (
                      <p className="text-[11px] text-slate-600 italic mt-0.5">💬 {r.completion_note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <Section title="Notes" emoji="🗒️">
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={listening ? 'Sun raha hoon... boliye' : 'Note likho ya 🎤 dabake boliye...'}
                rows={2}
                className={`w-full border rounded-xl pl-3 pr-11 py-2 text-xs font-semibold text-slate-700 outline-none resize-none transition-colors
                  ${listening ? 'border-red-400 bg-red-50/40' : 'border-slate-200 focus:border-brand-400'}`}
              />
              {speechSupported && (
                <button
                  onClick={toggleDictation}
                  title={listening ? 'Rok do' : 'Bolke likho'}
                  className={`absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-sm active:scale-90 transition-all
                    ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}
                >
                  {listening ? '■' : '🎤'}
                </button>
              )}
            </div>
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim() || noteSaving}
              className="w-full py-2 rounded-xl bg-brand-600 text-white text-xs font-bold disabled:opacity-40 active:scale-95"
            >
              + Add Note
            </button>
          </div>
          {notes.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2 mt-2">
              {notes.map(n => (
                <div key={n.event_id}>
                  <p className="text-xs text-slate-700">{n.data?.text}</p>
                  <p className="text-[10px] text-slate-400">
                    {n.salesman_id || 'Unknown'} · {new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-100 px-4 py-3 z-30">
        <div className="flex gap-3">
          <button
            onClick={openDashboard}
            className="flex-1 py-3 rounded-xl border border-brand-200 text-brand-600 text-sm font-bold active:bg-white transition-all"
          >
            🔄 Lead Badlo
          </button>
          <button
            onClick={() => { clearActiveCustomer(); openQuickCreate() }}
            className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold active:scale-95 transition-all shadow-lg shadow-brand-200"
          >
            + Nayi Lead
          </button>
        </div>
      </div>

    </div>
  )
}
