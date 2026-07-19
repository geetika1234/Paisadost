import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  getCurrentUser, setCurrentUser,
  getDashboardStats, getAssignedLeads, markCustomerFileLogin,
  saveCustomerResponse,
} from '../lib/db/dashboard'
import { deleteCustomer } from '../lib/db/customers'
import { createReminder, quickDueDate } from '../lib/db/reminders'
import { PROBLEMS } from '../logic/problems'
import { calcEMI, calculateCOD, calculateROI } from '../logic/calculations'

// Flat tag → label map for all sub-problems
const SUB_LABEL = {}
PROBLEMS.forEach(p => {
  p.subProblems.forEach(sp => { SUB_LABEL[sp.tag] = sp.label })
})

const DAILY_TARGET   = 20
const MONTHLY_TARGET = 400
const LOGIN_TARGET   = 40

const STAGE_LABEL = {
  visited:         { label: 'Visited'     },
  pain_identified: { label: 'Pain Done'   },
  roi_shown:       { label: 'ROI Shown'   },
  login_started:   { label: 'Login Done'  },
  approved:        { label: 'Approved'    },
  disbursed:       { label: 'Disbursed'   },
}

// Stages where ROI has been shown
const ROI_STAGES = new Set(['roi_shown', 'login_started', 'approved', 'disbursed'])

// ── Date filter bounds ────────────────────────────────────────────────────────
function getDateBounds(filter, customFrom, customTo) {
  const sob = d => { const r = new Date(d); r.setHours(0, 0, 0, 0);       return r }
  const eob = d => { const r = new Date(d); r.setHours(23, 59, 59, 999);  return r }
  const now = new Date()
  if (filter === 'today')     return [sob(now), eob(now)]
  if (filter === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return [sob(y), eob(y)] }
  if (filter === 'last7')     { const w = new Date(now); w.setDate(w.getDate() - 6); return [sob(w), eob(now)] }
  if (filter === 'custom')    return [customFrom ? sob(new Date(customFrom)) : null, customTo ? eob(new Date(customTo)) : null]
  return [null, null]
}

// ── Follow-up due-date filter ─────────────────────────────────────────────────
function matchFollowupFilter(dueAt, filter) {
  if (filter === 'all') return true
  const now = new Date()
  const d   = new Date(dueAt)
  if (filter === 'overdue') return d < now
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (filter === 'today')    return d.toDateString() === now.toDateString()
  if (filter === 'tomorrow') return d.toDateString() === tomorrow.toDateString()
  const end = new Date(now)
  end.setDate(now.getDate() + (filter === 'week' ? 7 : 15))
  end.setHours(23, 59, 59, 999)
  return d >= now && d <= end
}

// ── Group customers by visit date ─────────────────────────────────────────────
function groupByDate(customers) {
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups    = {}

  customers.forEach(c => {
    const d   = new Date(c.visitedAt)
    const key = d.toDateString()
    if (!groups[key]) groups[key] = { date: d, items: [] }
    groups[key].items.push(c)
  })

  return Object.entries(groups)
    .sort((a, b) => b[1].date - a[1].date)
    .map(([key, g]) => {
      const label =
        key === today     ? `Aaj — ${g.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` :
        key === yesterday ? `Kal — ${g.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` :
        g.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      return { label, items: g.items }
    })
}

// ── Ring Progress SVG ─────────────────────────────────────────────────────────

function RingProgress({ value, max, size = 88, stroke = 8, color = '#4f46e5' }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(value / max, 1)
  const dash = circ * pct
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  )
}

// ── Login screen ─────────────────────────────────────────────────────────────

function LoginView({ onLogin, onClose }) {
  const [name, setName] = useState('')
  return (
    <div className="phone-shell flex flex-col bg-white" style={{ minHeight: '100dvh' }}>
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0 flex items-center justify-between border-b border-slate-100">
        <div>
          <img src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png" alt="AR Financiers" className="h-6 w-auto object-contain mb-1" />
          <h1 className="text-xl font-extrabold leading-tight mt-0.5 text-slate-800">📊 Sales Dashboard</h1>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-slate-500 text-lg leading-none">×</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-5">
          <span className="text-4xl">👤</span>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-1 text-center">Login Karein</h2>
        <p className="text-sm text-slate-400 mb-8 text-center leading-relaxed">
          Apna performance track karne ke liye naam enter karein
        </p>
        <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aapka Naam</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.replace(/[0-9]/g, ''))}
            placeholder="Naam likho..."
            className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
            onKeyDown={e => e.key === 'Enter' && name.trim() && onLogin(name)}
            autoFocus
          />
        </div>
        <button
          onClick={() => name.trim() && onLogin(name)}
          disabled={!name.trim()}
          className="w-full py-4 bg-accent-400 text-white font-bold rounded-2xl disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-accent-200 text-base"
        >
          Dashboard Kholein →
        </button>
      </div>
    </div>
  )
}

// ── Insight item — compact label+value row ────────────────────────────────────
function InsightItem({ label, value, valueClass = 'text-slate-700', className = '' }) {
  if (!value) return null
  return (
    <div className={`flex items-start gap-1 ${className}`}>
      <span className="text-[10px] font-bold text-slate-400 flex-shrink-0 pt-0.5 w-14">{label}</span>
      <span className={`text-[11px] font-semibold leading-tight flex-1 ${valueClass}`}>{value}</span>
    </div>
  )
}

// ── Intent derivation (system-only, no manual override) ──────────────────────

function deriveIntent({ response, urgency, capitalNeeded, problemYears, problemMonths, businessFocus, hasProblem }) {
  if (response === 'not_interested') return { level: 'low',    label: '❄️ Low'    }

  // Base
  let level
  if (response === 'interested' && urgency === 'abhi' && capitalNeeded === 'haan') {
    level = 'high'
  } else if (response === 'thinking' || hasProblem) {
    level = 'medium'
  } else {
    level = 'low'
  }

  // Boosters — only upgrade from medium, cap at high
  if (level === 'medium') {
    const totalMonths = (parseInt(problemYears) || 0) * 12 + (parseInt(problemMonths) || 0)
    if (totalMonths > 12) {
      level = 'high'
    } else if (businessFocus && businessFocus.includes('आगे बढ़ाना')) {
      level = 'high'
    }
  }

  return level === 'high'
    ? { level: 'high',   label: '🔥 High'   }
    : level === 'medium'
    ? { level: 'medium', label: '🟡 Medium' }
    : { level: 'low',    label: '❄️ Low'    }
}

// ── Customer visit row ────────────────────────────────────────────────────────

function CustomerRow({ customer, onFileLogin, onSetActive, onDelete, salesman, profileId }) {
  const painData = customer.painData || null
  const roiData  = customer.roiData  || null
  const [response, setResponse] = useState(customer.response || null)
  const [saving,   setSaving]   = useState(false)
  const [reminder,        setReminder]        = useState(customer.nextReminder || null)
  const [reminderSaving,  setReminderSaving]  = useState(false)
  const [reminderNote,    setReminderNote]    = useState('')

  const time = new Date(customer.visitedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  const isCreatedToday = customer.customerCreatedAt
    ? new Date(customer.customerCreatedAt).toDateString() === new Date().toDateString()
    : false

  async function quickSetReminder(days) {
    if (reminderSaving) return
    setReminderSaving(true)
    try {
      const r = await createReminder(customer.customerId, quickDueDate(days), reminderNote, salesman, profileId)
      setReminder(r)
      setReminderNote('')
    } catch (_) {} finally { setReminderSaving(false) }
  }

  async function handleResponse(value) {
    if (saving || !value) { setResponse(null); return }
    setResponse(value)
    setSaving(true)
    try { await saveCustomerResponse(customer.customerId, value, salesman) } catch (_) {}
    setSaving(false)
  }

  // ── Derived insight values ──────────────────────────────────────────────
  const primaryProblem = painData?.primaryProblem
    ? (PROBLEMS.find(p => p.tag === painData.primaryProblem)?.title || painData.primaryProblem)
    : painData?.primaryOther || null

  const urgency      = painData?.priority      || null
  const capitalNeeded = painData?.capitalNeeded || null
  const problemYears  = painData?.problemYears  || painData?.problemDuration?.years  || ''
  const problemMonths = painData?.problemMonths || painData?.problemDuration?.months || ''
  const businessFocus = (customer.mindset || [])[0] || null
  const hasProblem    = !!(primaryProblem || (customer.problems || []).length > 0)

  const urgencyLabel   = urgency === 'abhi' ? '⚡ Abhi' : urgency === 'baad' ? '🕐 Baad Mein' : null
  const capitalLabel   = capitalNeeded === 'haan' ? '✅ Haan' : capitalNeeded === 'nahi' ? '❌ Nahi' : null
  const responseLabel  = response === 'interested'    ? '🟢 Interested'
                       : response === 'thinking'       ? '🟡 Soch Raha'
                       : response === 'not_interested' ? '🔴 Nahi'
                       : null
  const stageLabel     = (STAGE_LABEL[customer.stage] || STAGE_LABEL.visited).label
  const roiShown       = ROI_STAGES.has(customer.stage) || !!roiData

  // ROI line
  let roiLine = null
  if (roiData?.loanAmount > 0 && roiData?.tenureMonths > 0) {
    try {
      const roi = calculateROI(roiData)
      const emi = Math.round(roi.emiAmount)
      const gain = Math.round(roi.totalMonthlyGain)
      const fmtN = n => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${(n/1000).toFixed(0)}K`
      if (gain > 0) roiLine = `+${fmtN(gain)}/mo | EMI ${fmtN(emi)}`
    } catch (_) {}
  }

  // Intent
  const intent = deriveIntent({ response, urgency, capitalNeeded, problemYears, problemMonths, businessFocus, hasProblem })

  // Hot Lead: ALL four conditions must be true
  const isHot = response === 'interested' && urgency === 'abhi' && capitalNeeded === 'haan' && roiShown

  // Follow-up badge
  const reminderOverdue  = reminder && new Date(reminder.due_at) < new Date()
  const reminderDueToday = reminder && new Date(reminder.due_at).toDateString() === new Date().toDateString()
  const reminderLabel = !reminder ? null
    : reminderOverdue ? `⏰ Overdue — ${new Date(reminder.due_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
    : reminderDueToday ? `📅 Follow-up: Today ${new Date(reminder.due_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : `📅 Follow-up: ${new Date(reminder.due_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden shadow-sm
      ${isHot         ? 'border-orange-300 bg-orange-50/20'
      : customer.fileLogin ? 'border-green-200 bg-green-50/20'
      :                      'border-slate-200 bg-white'}`}>

      {/* 🔥 Hot Lead badge */}
      {isHot && (
        <div className="bg-orange-500 px-4 py-1.5 flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <span className="text-xs font-extrabold text-white uppercase tracking-widest">Hot Lead — Abhi Action Lo!</span>
        </div>
      )}

      {reminderLabel && (
        <div className={`px-4 py-1.5 flex items-center gap-2 ${reminderOverdue ? 'bg-red-500' : 'bg-blue-500'}`}>
          <span className="text-xs font-extrabold text-white uppercase tracking-widest">{reminderLabel}</span>
        </div>
      )}

      {/* Identity row */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-extrabold
          ${isHot ? 'bg-orange-100 text-orange-600' : customer.fileLogin ? 'bg-green-100 text-green-700' : 'bg-white text-brand-600'}`}>
          {customer.shopName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-slate-800 truncate">{customer.shopName}</p>
          <p className="text-xs text-slate-500 truncate">
            {customer.ownerName}{customer.city ? ` · ${customer.city}` : ''}{customer.market ? ` · ${customer.market}` : ''}
          </p>
          {customer.mobile && <p className="text-[10px] text-slate-400 mt-0.5">📞 {customer.mobile}</p>}
        </div>
        <div className="flex-shrink-0">
          {customer.fileLogin ? (
            <div className="flex items-center gap-1 bg-green-100 border border-green-200 rounded-xl px-2.5 py-1.5">
              <span className="text-xs">✅</span>
              <span className="text-xs font-bold text-green-700">Login Done</span>
            </div>
          ) : (
            <button
              onClick={() => onFileLogin(customer.id)}
              className="bg-accent-400 text-white text-xs font-bold rounded-xl px-3 py-2 active:scale-95 transition-all shadow-sm shadow-accent-200"
            >
              File Login
            </button>
          )}
        </div>
      </div>

      {/* Key Insights — 7 points, always visible */}
      <div className="mx-3 mb-2 bg-white border border-slate-100 rounded-xl px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
        <InsightItem label="Problem"  value={primaryProblem} className="col-span-2" />
        <InsightItem label="Urgency"  value={urgencyLabel}   valueClass={urgency === 'abhi' ? 'text-red-600' : 'text-amber-600'} />
        <InsightItem label="Stage"    value={stageLabel} />
        <InsightItem label="Capital"  value={capitalLabel} />
        <InsightItem label="ROI"      value={roiLine}        valueClass="text-green-700" />
        <InsightItem label="Response" value={responseLabel} />
        <InsightItem label="Intent"   value={intent.label}   valueClass={intent.level === 'high' ? 'text-orange-600 font-extrabold' : intent.level === 'medium' ? 'text-amber-600' : 'text-slate-400'} />
      </div>

      {/* Response + Details */}
      <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-2">
        <select
          value={response || ''}
          onChange={e => handleResponse(e.target.value || null)}
          disabled={saving}
          className={`flex-1 text-xs font-bold rounded-lg border px-2 py-1.5 outline-none appearance-none
            ${response === 'interested'     ? 'bg-green-50 border-green-300 text-green-700'
            : response === 'thinking'        ? 'bg-amber-50 border-amber-300 text-amber-700'
            : response === 'not_interested'  ? 'bg-red-50 border-red-300 text-red-600'
            :                                  'bg-white border-slate-200 text-slate-400'}`}
        >
          <option value=''>Response — Select</option>
          <option value='interested'>🟢 Interested</option>
          <option value='thinking'>🟡 Soch Raha</option>
          <option value='not_interested'>🔴 Nahi</option>
        </select>
        <button
          onClick={() => onSetActive(customer)}
          className={`px-4 py-1.5 rounded-lg text-xs font-extrabold active:scale-95 transition-all
            ${isHot ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' : 'bg-brand-600 text-white shadow-sm shadow-brand-200'}`}
        >
          Details →
        </button>
        {isCreatedToday && (
          <button
            onClick={() => onDelete(customer)}
            className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-red-50 border border-red-200 text-red-600 active:scale-95 transition-all"
          >
            🗑️
          </button>
        )}
      </div>

      {response && !reminder && (
        <div className="px-3 pb-2">
          <p className="text-[10px] font-bold text-slate-400 mb-1">📅 Follow-up set karo:</p>
          <input
            type="text"
            value={reminderNote}
            onChange={e => setReminderNote(e.target.value)}
            placeholder="Follow-up me kya karna hai? (optional)"
            className="w-full mb-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-brand-400"
          />
          <div className="flex gap-1">
            {[['Kal', 1], ['3 din', 3], ['1 hafta', 7], ['15 din', 15], ['1 mahina', 30]].map(([label, days]) => (
              <button
                key={days}
                onClick={() => quickSetReminder(days)}
                disabled={reminderSaving}
                className="flex-1 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold active:scale-95 disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function S_Dashboard() {
  const { closeDashboard, openCustomerFormForEdit, activateCustomer, profile } = useApp()
  const isAdmin = profile?.role === 'admin'

  function handleEdit(customer) {
    closeDashboard()
    openCustomerFormForEdit(customer)
  }

  function handleSetActive(customer) {
    const hasEngagementData = (
      customer.bizTypes?.length > 0 ||
      !!customer.bizTypeOther ||
      customer.seasons?.length > 0 ||
      customer.peakMonths?.length > 0 ||
      !!customer.investmentTiming ||
      !!customer.decisionDelay
    )

    // Use batch-fetched pain + ROI data already attached to customer
    let painData = null
    let painFilled = false
    let savedROIInputs = null
    let roiFilled = false

    const painEv = customer.painData
    const roiEv  = customer.roiData

    if (painEv) {
      painData = {
        primaryProblem: painEv.primaryProblem              || null,
        subProblems:    painEv.subProblems                 || [],
        q1Other:        painEv.primaryOther                || '',
        notesByQ:       painEv.notesByQuestion             || {},
        problemYears:   painEv.problemDuration?.years      || '',
        problemMonths:  painEv.problemDuration?.months     || '',
        priority:       painEv.priority                    || '',
        capitalNeeded:  painEv.capitalNeeded               || '',
        dailyLoss:      painEv.dailyLoss    ?? null,
        monthlyLoss:    painEv.monthlyLoss  ?? null,
      }
      painFilled = true
    }
    if (roiEv) {
      savedROIInputs = roiEv
      roiFilled = true
    }

    const stage = customer.stage || 'visited'

    activateCustomer({
      savedROIInputs,
      id:                  customer.customerId,
      visitEventId:        customer.id,          // visit event_id for engagement form updates
      shopName:            customer.shopName,
      ownerName:           customer.ownerName,
      mobile:              customer.mobile,
      city:                customer.city,
      market:              customer.market,
      stage,
      // Engagement form data — pre-fills form on reopen
      bizTypes:            customer.bizTypes            || [],
      bizTypeOther:        customer.bizTypeOther        || '',
      seasons:             customer.seasons             || [],
      seasonOther:         customer.seasonOther         || '',
      peakMonths:          customer.peakMonths          || [],
      offSeasonSales:      customer.offSeasonSales      || '',
      offSeasonSalesOther: customer.offSeasonSalesOther || '',
      investmentTiming:    customer.investmentTiming    || '',
      prepTime:            customer.prepTime            || '',
      prepTimeOther:       customer.prepTimeOther       || '',
      problems:            customer.problems            || [],
      decisionDelay:       customer.decisionDelay       || '',
      decisionDelayDetail: customer.decisionDelayDetail || '',
      mindset:             customer.mindset             || [],
      mindsetOther:        customer.mindsetOther        || '',
      photoUrls:           customer.photoUrls           || [],
      engagementFilled:    hasEngagementData,
      roiFilled,
      // Pain discovery data
      painFilled,
      painData,
    })
    closeDashboard()
  }
  const [user,             setUser]             = useState(() => getCurrentUser())

  // Auto-login from profile when authenticated
  useEffect(() => {
    if (profile?.fullname && !user) {
      setCurrentUser(profile.fullname)
      setUser(profile.fullname)
    }
  }, [profile?.fullname, user])
  const [data,             setData]             = useState({ todayVisits: 0, monthVisits: 0, fileLogin: 0 })
  const [customers,        setCustomers]        = useState([])
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState(null)
  const [tab,              setTab]              = useState('today')
  const [deletingCustomer, setDeletingCustomer] = useState(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const [deleteSuccess,    setDeleteSuccess]    = useState(false)
  const [search,           setSearch]           = useState('')
  const [dateFilter,       setDateFilter]       = useState('all')   // 'all' | 'today' | 'yesterday' | 'last7' | 'custom'
  const [customFrom,       setCustomFrom]       = useState('')
  const [customTo,         setCustomTo]         = useState('')
  const [responseFilter,   setResponseFilter]   = useState('all')   // 'all' | 'interested' | 'soch_raha' | 'nahi'
  const [followupFilter,   setFollowupFilter]   = useState('all')   // 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | '15days'

  const loadDashboard = useCallback(async (salesman) => {
    setLoading(true)
    setError(null)
    try {
      const [stats, leads] = await Promise.all([
        getDashboardStats(salesman),
        getAssignedLeads(isAdmin ? null : profile?.id),
      ])
      setData(stats)
      setCustomers(leads)
    } catch (err) {
      setError(err.message || 'Data load karne mein error aayi.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, profile?.id])

  useEffect(() => {
    if (user) loadDashboard(user)
  }, [user, loadDashboard])

  function handleLogin(name) {
    setCurrentUser(name)
    setUser(name.trim())
  }

  async function handleFileLogin(customerId) {
    setError(null)
    try {
      await markCustomerFileLogin(user, customerId)
      await loadDashboard(user)
    } catch (err) {
      setError(err.message || 'File login mark karne mein error aayi.')
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCustomer) return
    setDeleteLoading(true)
    try {
      await deleteCustomer(deletingCustomer.customerId)
      setCustomers(prev => prev.filter(c => c.customerId !== deletingCustomer.customerId))
      setDeletingCustomer(null)
      setDeleteSuccess(true)
      setTimeout(() => setDeleteSuccess(false), 3000)
      // Refresh stats since visit count changed
      getDashboardStats(user).then(setData).catch(() => {})
    } catch (err) {
      setError(err.message || 'Delete karne mein error aayi.')
      setDeletingCustomer(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (!user) {
    if (profile?.fullname) {
      return (
        <div className="phone-shell flex items-center justify-center bg-white" style={{ minHeight: '100dvh' }}>
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      )
    }
    return <LoginView onLogin={handleLogin} onClose={closeDashboard} />
  }

  const todayStr       = new Date().toDateString()
  const todayCustomers = customers.filter(c => new Date(c.visitedAt).toDateString() === todayStr)
  const allPending     = customers.filter(c => !c.fileLogin)
  const convRate       = data.monthVisits ? Math.round((data.fileLogin / data.monthVisits) * 100) : 0
  const hotLead        = allPending[0] || null

  const todayLoggedIn  = todayCustomers.filter(c => c.fileLogin).length
  const todayPending   = todayCustomers.filter(c => !c.fileLogin).length

  const isOnTrack = data.todayVisits >= Math.round(DAILY_TARGET * 0.5)

  // ── Combined search + date + response filter ─────────────────────────────
  const searchTrimmed  = search.trim()
  const searchActive   = searchTrimmed.length > 0
  const dateActive     = dateFilter !== 'all'
  const responseActive = responseFilter !== 'all'

  const [dateFrom, dateTo] = getDateBounds(dateFilter, customFrom, customTo)

  const dateFilteredCustomers = dateActive
    ? customers.filter(c => {
        if (!c.customerCreatedAt) return false
        const d = new Date(c.customerCreatedAt)
        if (dateFrom && d < dateFrom) return false
        if (dateTo   && d > dateTo)   return false
        return true
      })
    : customers

  // Response counts (computed from date-filtered pool)
  const responseCounts = {
    interested: dateFilteredCustomers.filter(c => c.response === 'interested').length,
    soch_raha:  dateFilteredCustomers.filter(c => c.response === 'thinking').length,
    nahi:       dateFilteredCustomers.filter(c => c.response === 'not_interested').length,
  }

  const RESPONSE_DB_MAP = { interested: 'interested', soch_raha: 'thinking', nahi: 'not_interested' }

  const responseFilteredCustomers = responseActive
    ? dateFilteredCustomers.filter(c => c.response === RESPONSE_DB_MAP[responseFilter])
    : dateFilteredCustomers

  const filteredResults = searchActive
    ? responseFilteredCustomers.filter(c => {
        const q = searchTrimmed.toLowerCase()
        return (c.ownerName || '').toLowerCase().includes(q) ||
               (c.shopName  || '').toLowerCase().includes(q) ||
               (c.mobile    || '').toLowerCase().includes(q)
      })
    : responseFilteredCustomers

  const filterActive = searchActive || dateActive || responseActive

  // ── Follow-up tab data ────────────────────────────────────────────────────
  const remCustomers = customers.filter(c => c.nextReminder)
  const followupCounts = {
    all:      remCustomers.length,
    overdue:  remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, 'overdue')).length,
    today:    remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, 'today')).length,
    tomorrow: remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, 'tomorrow')).length,
    week:     remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, 'week')).length,
    '15days': remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, '15days')).length,
  }
  const followupCustomers = remCustomers.filter(c => matchFollowupFilter(c.nextReminder.due_at, followupFilter))

  const filterLabel = dateFilter === 'today'     ? 'Today'
                    : dateFilter === 'yesterday'  ? 'Yesterday'
                    : dateFilter === 'last7'      ? 'Last 7 Days'
                    : dateFilter === 'custom' && (customFrom || customTo)
                      ? `${customFrom || '...'} → ${customTo || '...'}`
                    : null

  function resetFilters() { setSearch(''); setDateFilter('all'); setCustomFrom(''); setCustomTo(''); setResponseFilter('all') }

  return (
    <div className="phone-shell flex flex-col bg-slate-50" style={{ minHeight: '100dvh' }}>

      {/* ── HEADER ── */}
      <div className="bg-white pt-12 pb-4 px-5 flex-shrink-0 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <img src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png" alt="AR Financiers" className="h-7 w-auto object-contain mb-1" />
            <h1 className="text-lg font-extrabold leading-tight mt-0.5 text-slate-800">📊 Sales Dashboard</h1>
          </div>
          <button onClick={closeDashboard} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-slate-500 text-xl leading-none">×</button>
        </div>

        {/* Salesman + Daily Ring */}
        <div className="bg-brand-600 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <RingProgress value={data.todayVisits} max={DAILY_TARGET} size={64} stroke={6} color="#F08030" />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <p className="text-white text-sm font-extrabold leading-none">{data.todayVisits}</p>
              <p className="text-brand-200 text-[9px] font-bold">visits</p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-extrabold text-base leading-tight truncate">{user}</p>
            <p className="text-brand-200 text-xs">Sales Executive</p>
            <p className="text-brand-100 text-xs mt-0.5 font-semibold">
              {isOnTrack ? '🔥 On track!' : `${DAILY_TARGET - data.todayVisits} visits left for target`}
            </p>
          </div>
          {!profile && (
            <button
              onClick={() => { setUser(null); setData({ todayVisits: 0, monthVisits: 0, fileLogin: 0 }); setCustomers([]) }}
              className="text-brand-200 text-xs font-semibold border border-brand-400 rounded-lg px-2.5 py-1 active:scale-95 flex-shrink-0"
            >
              Switch
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto pb-10">

        {/* Tab bar */}
        <div className="flex bg-white border-b border-slate-200 px-4">
          {[
            { key: 'today', label: 'Aaj' },
            { key: 'month', label: 'Is Mahine' },
            { key: 'leads', label: 'Leads' },
            { key: 'followups', label: 'Follow-ups' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all
                ${tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + Date Filter — hidden on Follow-ups tab (it has its own filters) */}
        {tab !== 'followups' && (
        <div className="px-4 pt-3 pb-3 bg-white border-b border-slate-100 space-y-2">

          {/* Search input */}
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${searchActive ? 'border-brand-400 bg-white' : 'border-slate-200 bg-white'}`}>
            <span className="text-slate-400 text-sm flex-shrink-0">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by owner, shop or mobile..."
              className="flex-1 text-sm font-semibold text-slate-700 bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal"
            />
            {filterActive && (
              <button onClick={resetFilters} className="text-slate-400 text-base leading-none flex-shrink-0">×</button>
            )}
          </div>

          {/* Date filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {[
              { key: 'all',       label: 'All' },
              { key: 'today',     label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last7',     label: 'Last 7 Days' },
              { key: 'custom',    label: '📅 Custom' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setDateFilter(opt.key)}
                className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95
                  ${dateFilter === opt.key
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white border-slate-200 text-slate-500'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Response filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {[
              { key: 'all',        label: 'All',        emoji: null,  count: null },
              { key: 'interested', label: 'Interested', emoji: '🟢', count: responseCounts.interested },
              { key: 'soch_raha',  label: 'Soch Raha',  emoji: '🟡', count: responseCounts.soch_raha },
              { key: 'nahi',       label: 'Nahi',       emoji: '🔴', count: responseCounts.nahi },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setResponseFilter(opt.key)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95
                  ${responseFilter === opt.key
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white border-slate-200 text-slate-500'}`}
              >
                {opt.emoji && <span>{opt.emoji}</span>}
                {opt.label}
                {opt.count !== null && (
                  <span className={`ml-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    responseFilter === opt.key ? 'bg-white/25 text-white' : 'bg-white text-slate-500'
                  }`}>
                    {opt.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Custom date range pickers */}
          {dateFilter === 'custom' && (
            <div className="flex gap-2 pt-1">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From</p>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To</p>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}

        </div>
        )}

        {/* Follow-up time filter chips — only on Follow-ups tab */}
        {tab === 'followups' && (
          <div className="px-4 pt-3 pb-3 bg-white border-b border-slate-100">
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
              {[
                { key: 'all',      label: 'All' },
                { key: 'overdue',  label: '⏰ Overdue' },
                { key: 'today',    label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'week',     label: 'This Week' },
                { key: '15days',   label: '15 Days' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFollowupFilter(opt.key)}
                  className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95
                    ${followupFilter === opt.key
                      ? (opt.key === 'overdue' ? 'bg-red-500 border-red-500 text-white' : 'bg-brand-600 border-brand-600 text-white')
                      : 'bg-white border-slate-200 text-slate-500'}`}
                >
                  {opt.label}
                  <span className={`ml-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    followupFilter === opt.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {followupCounts[opt.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* Delete success banner */}
        {deleteSuccess && (
          <div className="mx-4 mt-3 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-xs font-semibold text-green-700">
            ✅ Customer and all data deleted successfully
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="w-5 h-5 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Load ho raha hai...</p>
          </div>
        )}

        <div className="px-4 pt-4">

          {/* ══ FILTERED RESULTS (search and/or date) ══ */}
          {filterActive && tab !== 'followups' && (
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-extrabold text-slate-700">
                    {[searchActive && 'Search', dateActive && 'Date', responseActive && 'Response'].filter(Boolean).join(' + ') + ' Filter'}
                  </p>
                  {filterLabel && (
                    <p className="text-[11px] text-brand-500 font-semibold mt-0.5">{filterLabel}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-brand-600 bg-white border border-brand-200 rounded-full px-2.5 py-0.5">
                    {filteredResults.length} found
                  </span>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] font-bold text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 active:scale-95 transition-all"
                  >
                    Reset
                  </button>
                </div>
              </div>
              {filteredResults.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm font-bold text-slate-500">No results found</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting your search, date or response filter</p>
                </div>
              ) : (
                filteredResults.map(c => (
                  <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                ))
              )}
            </div>
          )}

          {/* ══ TAB: AAJJ ══ */}
          {!filterActive && tab === 'today' && (
            <div>
              {data.todayVisits === 0 ? (
                <div className="mb-4 px-4 py-3 rounded-2xl border bg-white border-slate-200 flex items-center gap-2">
                  <span>👋</span>
                  <p className="text-xs font-bold text-slate-500">Din ki shuruaat karo — pehla visit karo!</p>
                </div>
              ) : isOnTrack ? (
                <div className="mb-4 px-4 py-3 rounded-2xl border bg-green-50 border-green-200 flex items-center gap-2">
                  <span>🔥</span>
                  <p className="text-xs font-bold text-green-700">Excellent! Target ke raaste par ho</p>
                </div>
              ) : (
                <div className="mb-4 px-4 py-3 rounded-2xl border bg-amber-50 border-amber-200 flex items-center gap-2">
                  <span>⚡</span>
                  <p className="text-xs font-bold text-amber-700">{DAILY_TARGET - data.todayVisits} aur visits karo — target poora karo!</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Visits',  value: data.todayVisits, target: DAILY_TARGET, color: 'indigo' },
                  { label: 'Logined', value: todayLoggedIn,    target: null,          color: 'green'  },
                  { label: 'Pending', value: todayPending,     target: null,          color: todayPending > 0 ? 'amber' : 'green' },
                ].map(s => {
                  const bg   = { indigo: 'bg-white', green: 'bg-green-50', amber: 'bg-amber-50' }
                  const text = { indigo: 'text-brand-600', green: 'text-green-600', amber: 'text-amber-600' }
                  return (
                    <div key={s.label} className={`${bg[s.color]} rounded-2xl p-3 text-center`}>
                      <p className={`text-2xl font-extrabold ${text[s.color]}`}>{s.value}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                      {s.target && <p className="text-[9px] text-slate-400 mt-0.5">/ {s.target}</p>}
                    </div>
                  )
                })}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-slate-600">Daily Target Progress</p>
                  <p className="text-xs font-extrabold text-brand-600">{data.todayVisits} / {DAILY_TARGET}</p>
                </div>
                <div className="h-3 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all"
                    style={{ width: `${Math.min((data.todayVisits / DAILY_TARGET) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 text-right">
                  {Math.round((data.todayVisits / DAILY_TARGET) * 100)}% complete
                </p>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-extrabold text-slate-700">Aaj ke Customers</p>
                <span className="text-xs font-bold text-slate-400 bg-slate-200 rounded-full px-2.5 py-0.5">{todayCustomers.length}</span>
              </div>

              {todayCustomers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 px-4 py-8 text-center">
                  <p className="text-3xl mb-2">🏪</p>
                  <p className="text-sm font-bold text-slate-500">Abhi koi customer nahi</p>
                  <p className="text-xs text-slate-400 mt-1">Engagement form bharo — naam yahan aayega</p>
                </div>
              ) : (
                todayCustomers.map(c => (
                  <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                ))
              )}
            </div>
          )}

          {/* ══ TAB: IS MAHINE ══ */}
          {!filterActive && tab === 'month' && (
            <div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <RingProgress value={data.monthVisits} max={MONTHLY_TARGET} size={80} stroke={7} color="#4f46e5" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-slate-800 text-base font-extrabold leading-none">{data.monthVisits}</p>
                    <p className="text-slate-400 text-[9px] font-bold">visits</p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monthly Progress</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Visits</span>
                      <span className="font-extrabold text-brand-600">{data.monthVisits} / {MONTHLY_TARGET}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">File Logins</span>
                      <span className="font-extrabold text-green-600">{data.fileLogin} / {LOGIN_TARGET}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Conversion</span>
                      <span className={`font-extrabold ${convRate >= 10 ? 'text-green-600' : 'text-red-500'}`}>{convRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Total Visits',  value: data.monthVisits, sub: `Target: ${MONTHLY_TARGET}`, color: 'bg-white text-brand-600' },
                  { label: 'File Logins',   value: data.fileLogin,   sub: `Target: ${LOGIN_TARGET}`,   color: 'bg-green-50 text-green-600'   },
                  { label: 'Conversion %',  value: `${convRate}%`,   sub: convRate >= 10 ? 'Good!' : 'Improve karo', color: convRate >= 10 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500' },
                  { label: 'Aaj ke Visits', value: data.todayVisits, sub: `Target: ${DAILY_TARGET}`,   color: 'bg-purple-50 text-purple-600' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-4 ${s.color.split(' ')[0]}`}>
                    <p className="text-xs font-bold text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-extrabold ${s.color.split(' ')[1]}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-slate-600">File Login Target</p>
                  <p className="text-xs font-extrabold text-amber-600">{data.fileLogin} / {LOGIN_TARGET}</p>
                </div>
                <div className="h-3 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min((data.fileLogin / LOGIN_TARGET) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 text-right">
                  {Math.round((data.fileLogin / LOGIN_TARGET) * 100)}% complete
                </p>
              </div>

              {/* All customers grouped by date */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-extrabold text-slate-700">Saare Customers</p>
                <span className="text-xs font-bold text-slate-400 bg-slate-200 rounded-full px-2.5 py-0.5">{customers.length}</span>
              </div>
              {customers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 px-4 py-8 text-center">
                  <p className="text-3xl mb-2">🏪</p>
                  <p className="text-sm font-bold text-slate-500">Koi customer nahi</p>
                </div>
              ) : (
                groupByDate(customers).map(group => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-2 mt-3">
                      <span className="text-xs font-bold text-brand-500">🗓️ {group.label}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-200 rounded-full px-1.5 py-0.5">{group.items.length}</span>
                    </div>
                    {group.items.map(c => (
                      <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ TAB: LEADS ══ */}
          {!filterActive && tab === 'leads' && (
            <div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-extrabold text-slate-700">🎯 Next Lead</h2>
                  <span className="text-[10px] font-bold text-slate-400 bg-white rounded-full px-2 py-0.5">
                    {allPending.length} pending
                  </span>
                </div>

                {hotLead ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-base font-extrabold text-brand-600 flex-shrink-0">
                        {hotLead.shopName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-extrabold text-slate-800 truncate">{hotLead.shopName}</p>
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex-shrink-0">🔥 Hot</span>
                        </div>
                        <p className="text-xs text-slate-500">{hotLead.ownerName}</p>
                        {(hotLead.city || hotLead.market) && (
                          <p className="text-xs text-slate-400">📍 {[hotLead.city, hotLead.market].filter(Boolean).join(' · ')}</p>
                        )}
                        {hotLead.mobile && (
                          <p className="text-xs text-brand-500 font-semibold">📞 {hotLead.mobile}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileLogin(hotLead.id)}
                      className="w-full bg-accent-400 text-white text-sm font-bold py-3 rounded-xl active:scale-95 transition-all shadow-md shadow-accent-200"
                    >
                      📂 File Login Karen
                    </button>
                  </>
                ) : customers.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-2">🏪</p>
                    <p className="text-sm font-bold text-slate-500">Koi lead nahi</p>
                    <p className="text-xs text-slate-400 mt-1">Engagement form bharo — lead yahan aayegi</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <span className="text-xl">✅</span>
                    <p className="text-sm font-bold text-green-600">Sabhi leads complete!</p>
                  </div>
                )}
              </div>

              {allPending.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-extrabold text-slate-700">Pending Leads</p>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">{allPending.length} left</span>
                  </div>
                  {groupByDate(allPending).map(group => (
                    <div key={group.label}>
                      <div className="flex items-center gap-2 mb-2 mt-3">
                        <span className="text-xs font-bold text-amber-600">🗓️ {group.label}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-200 rounded-full px-1.5 py-0.5">{group.items.length}</span>
                      </div>
                      {group.items.map(c => (
                        <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ══ TAB: FOLLOW-UPS ══ */}
          {tab === 'followups' && (() => {
            const now = new Date()
            const overdue = followupCustomers
              .filter(c => new Date(c.nextReminder.due_at) < now)
              .sort((a, b) => new Date(a.nextReminder.due_at) - new Date(b.nextReminder.due_at))
            const upcoming = followupCustomers
              .filter(c => new Date(c.nextReminder.due_at) >= now)
              .sort((a, b) => new Date(a.nextReminder.due_at) - new Date(b.nextReminder.due_at))
            return (
              <div>
                {followupCustomers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
                    <p className="text-3xl mb-2">📅</p>
                    <p className="text-sm font-bold text-slate-500">
                      {remCustomers.length === 0 ? 'Koi follow-up pending nahi' : 'Is time period me koi follow-up nahi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {remCustomers.length === 0 ? 'Lead ke Workspace se follow-up set karo' : 'Doosra filter chuno'}
                    </p>
                  </div>
                ) : (
                  <>
                    {overdue.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-extrabold text-red-600 uppercase tracking-widest">⏰ Overdue</span>
                          <span className="text-[10px] text-white bg-red-500 rounded-full px-1.5 py-0.5">{overdue.length}</span>
                        </div>
                        {overdue.map(c => (
                          <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                        ))}
                      </>
                    )}
                    {upcoming.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 mb-2 mt-3">
                          <span className="text-xs font-extrabold text-brand-600 uppercase tracking-widest">📅 Upcoming</span>
                          <span className="text-[10px] text-white bg-brand-500 rounded-full px-1.5 py-0.5">{upcoming.length}</span>
                        </div>
                        {upcoming.map(c => (
                          <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} onSetActive={handleSetActive} onDelete={setDeletingCustomer} salesman={user} profileId={profile?.id} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })()}

        </div>
      </div>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗑️</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-800 text-center mb-2">Customer Delete Karein?</h2>
            <p className="text-xs text-slate-500 text-center leading-relaxed mb-3">
              Are you sure you want to delete this customer and all related data?
            </p>
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 mb-4 text-center">
              <p className="text-sm font-extrabold text-slate-800">{deletingCustomer.shopName}</p>
              <p className="text-xs text-slate-500">{deletingCustomer.ownerName}</p>
            </div>
            <p className="text-[10px] text-red-500 text-center mb-4 font-semibold">
              ⚠️ Yeh action undo nahi ho sakta — events, loans aur saara data delete ho jayega.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingCustomer(null)}
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 bg-white active:scale-95 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 shadow-sm shadow-red-200"
              >
                {deleteLoading ? 'Deleting...' : 'Haan, Delete Karo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
