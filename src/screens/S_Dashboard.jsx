import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  getCurrentUser, setCurrentUser,
  getDashboardStats, getVisitedCustomers, markCustomerFileLogin,
} from '../lib/db/dashboard'

const DAILY_TARGET   = 20
const MONTHLY_TARGET = 400
const LOGIN_TARGET   = 40

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
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>
      <div className="bg-indigo-700 text-white pt-12 pb-5 px-5 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-indigo-300 uppercase tracking-widest">PaisaDost</p>
          <h1 className="text-xl font-extrabold leading-tight mt-0.5">📊 Sales Dashboard</h1>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none">×</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-5">
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
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-indigo-200 text-base"
        >
          Dashboard Kholein →
        </button>
      </div>
    </div>
  )
}

// ── Customer visit row ────────────────────────────────────────────────────────

function CustomerRow({ customer, onFileLogin, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const time = new Date(customer.visitedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  const visibleBizTypes = (customer.bizTypes || []).filter(v => v !== '__other__')
  const hasDetails = visibleBizTypes.length > 0 || customer.bizTypeOther ||
    (customer.problems || []).length > 0 || (customer.seasons || []).length > 0 ||
    customer.offSeasonSales || customer.prepTime || (customer.photoUrls || []).length > 0

  return (
    <div className={`bg-white rounded-2xl border mb-2.5 overflow-hidden
      ${customer.fileLogin ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>

      {/* Main row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-extrabold
          ${customer.fileLogin ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600'}`}>
          {customer.shopName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-slate-800 truncate">{customer.shopName}</p>
          <p className="text-xs text-slate-400 truncate">
            {customer.ownerName}
            {customer.city   ? ` · ${customer.city}`   : ''}
            {customer.market ? ` · ${customer.market}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-slate-400">🕐 {time}</p>
            {customer.mobile ? <p className="text-[10px] text-slate-400">📞 {customer.mobile}</p> : null}
            {hasDetails && (
              <button onClick={() => setExpanded(e => !e)} className="text-[10px] font-bold text-indigo-500">
                {expanded ? '▲ Less' : '▼ Details'}
              </button>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
          {!customer.fileLogin && (
            <button
              onClick={() => onEdit(customer)}
              className="text-[10px] font-bold text-slate-400 border border-slate-200 rounded-lg px-2 py-1 active:scale-95 transition-all"
            >
              ✏️ Edit
            </button>
          )}
          {customer.fileLogin ? (
            <div className="flex items-center gap-1 bg-green-100 border border-green-200 rounded-xl px-2.5 py-1.5">
              <span className="text-xs">✅</span>
              <span className="text-xs font-bold text-green-700">Done</span>
            </div>
          ) : (
            <button
              onClick={() => onFileLogin(customer.id)}
              className="bg-indigo-600 text-white text-xs font-bold rounded-xl px-3 py-2 active:scale-95 transition-all shadow-sm shadow-indigo-200 whitespace-nowrap"
            >
              File Login
            </button>
          )}
        </div>
      </div>

      {/* Expandable detail panel — reads arrays from event.data */}
      {expanded && hasDetails && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-1.5 bg-slate-50">
          {(visibleBizTypes.length > 0 || customer.bizTypeOther) && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Business: </span>
              {[...visibleBizTypes, customer.bizTypeOther].filter(Boolean).join(', ')}
            </p>
          )}
          {(customer.seasons || []).length > 0 && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Season: </span>
              {customer.seasons.join(', ')}
              {customer.seasonOther ? `, ${customer.seasonOther}` : ''}
            </p>
          )}
          {(customer.peakMonths || []).length > 0 && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Peak Months: </span>
              {customer.peakMonths.join(', ')}
            </p>
          )}
          {customer.offSeasonSales && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Off Season Sales: </span>
              {customer.offSeasonSales === 'other' ? customer.offSeasonSalesOther : customer.offSeasonSales}
            </p>
          )}
          {customer.investmentTiming && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Investment Timing: </span>
              {customer.investmentTiming}
            </p>
          )}
          {customer.prepTime && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Prep Time: </span>
              {customer.prepTime === 'other' ? customer.prepTimeOther : customer.prepTime}
            </p>
          )}
          {(customer.problems || []).length > 0 && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Problems: </span>
              {customer.problems.join(', ')}
            </p>
          )}
          {customer.decisionDelay && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Decision Delay: </span>
              {customer.decisionDelay}
            </p>
          )}
          {(customer.mindset || []).length > 0 && (
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">Mindset: </span>
              {customer.mindset.join(', ')}
              {customer.mindsetOther ? `, ${customer.mindsetOther}` : ''}
            </p>
          )}
          {(customer.photoUrls || []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1.5">Photos:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {customer.photoUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function S_Dashboard() {
  const { closeDashboard, openCustomerFormForEdit } = useApp()

  function handleEdit(customer) {
    closeDashboard()
    openCustomerFormForEdit(customer)
  }
  const [user,      setUser]      = useState(() => getCurrentUser())
  const [data,      setData]      = useState({ todayVisits: 0, monthVisits: 0, fileLogin: 0 })
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [tab,       setTab]       = useState('today')

  const loadDashboard = useCallback(async (salesman) => {
    setLoading(true)
    setError(null)
    try {
      const [stats, visits] = await Promise.all([
        getDashboardStats(salesman),
        getVisitedCustomers(salesman),
      ])
      setData(stats)
      setCustomers(visits)
    } catch (err) {
      setError(err.message || 'Data load karne mein error aayi.')
    } finally {
      setLoading(false)
    }
  }, [])

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

  if (!user) return <LoginView onLogin={handleLogin} onClose={closeDashboard} />

  const todayStr       = new Date().toDateString()
  const todayCustomers = customers.filter(c => new Date(c.visitedAt).toDateString() === todayStr)
  const allPending     = customers.filter(c => !c.fileLogin)
  const convRate       = data.monthVisits ? Math.round((data.fileLogin / data.monthVisits) * 100) : 0
  const hotLead        = allPending[0] || null

  const todayLoggedIn  = todayCustomers.filter(c => c.fileLogin).length
  const todayPending   = todayCustomers.filter(c => !c.fileLogin).length

  const isOnTrack = data.todayVisits >= Math.round(DAILY_TARGET * 0.5)

  return (
    <div className="phone-shell flex flex-col bg-gray-100" style={{ minHeight: '100dvh' }}>

      {/* ── HEADER ── */}
      <div className="bg-indigo-700 text-white pt-12 pb-5 px-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-indigo-300 uppercase tracking-widest">PaisaDost</p>
            <h1 className="text-lg font-extrabold leading-tight mt-0.5">📊 Sales Dashboard</h1>
          </div>
          <button onClick={closeDashboard} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xl leading-none">×</button>
        </div>

        {/* Salesman + Daily Ring */}
        <div className="bg-white/15 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <RingProgress value={data.todayVisits} max={DAILY_TARGET} size={64} stroke={6} color="#a5b4fc" />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <p className="text-white text-sm font-extrabold leading-none">{data.todayVisits}</p>
              <p className="text-indigo-300 text-[9px] font-bold">visits</p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-extrabold text-base leading-tight truncate">{user}</p>
            <p className="text-indigo-300 text-xs">Sales Executive</p>
            <p className="text-indigo-200 text-xs mt-0.5 font-semibold">
              {isOnTrack ? '🔥 On track!' : `${DAILY_TARGET - data.todayVisits} visits left for target`}
            </p>
          </div>
          <button
            onClick={() => { setUser(null); setData({ todayVisits: 0, monthVisits: 0, fileLogin: 0 }); setCustomers([]) }}
            className="text-indigo-300 text-xs font-semibold border border-indigo-400/50 rounded-lg px-2.5 py-1 active:scale-95 flex-shrink-0"
          >
            Switch
          </button>
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
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all
                ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="w-5 h-5 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Load ho raha hai...</p>
          </div>
        )}

        <div className="px-4 pt-4">

          {/* ══ TAB: AAJJ ══ */}
          {tab === 'today' && (
            <div>
              {data.todayVisits === 0 ? (
                <div className="mb-4 px-4 py-3 rounded-2xl border bg-slate-50 border-slate-200 flex items-center gap-2">
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
                  const bg   = { indigo: 'bg-indigo-50', green: 'bg-green-50', amber: 'bg-amber-50' }
                  const text = { indigo: 'text-indigo-600', green: 'text-green-600', amber: 'text-amber-600' }
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
                  <p className="text-xs font-extrabold text-indigo-600">{data.todayVisits} / {DAILY_TARGET}</p>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
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
                  <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} />
                ))
              )}
            </div>
          )}

          {/* ══ TAB: IS MAHINE ══ */}
          {tab === 'month' && (
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
                      <span className="font-extrabold text-indigo-600">{data.monthVisits} / {MONTHLY_TARGET}</span>
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
                  { label: 'Total Visits',  value: data.monthVisits, sub: `Target: ${MONTHLY_TARGET}`, color: 'bg-indigo-50 text-indigo-600' },
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
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
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
                      <span className="text-xs font-bold text-indigo-500">🗓️ {group.label}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-200 rounded-full px-1.5 py-0.5">{group.items.length}</span>
                    </div>
                    {group.items.map(c => (
                      <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ TAB: LEADS ══ */}
          {tab === 'leads' && (
            <div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-extrabold text-slate-700">🎯 Next Lead</h2>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {allPending.length} pending
                  </span>
                </div>

                {hotLead ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-base font-extrabold text-indigo-600 flex-shrink-0">
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
                          <p className="text-xs text-indigo-500 font-semibold">📞 {hotLead.mobile}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileLogin(hotLead.id)}
                      className="w-full bg-indigo-600 text-white text-sm font-bold py-3 rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-200"
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
                        <CustomerRow key={c.id} customer={c} onFileLogin={handleFileLogin} onEdit={handleEdit} />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
