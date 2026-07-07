import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getAllProfiles, approveUser, updateProfile } from '../lib/db/profiles'
import { getAllCustomersAdmin, assignCustomer } from '../lib/db/customers'

const ROLES = ['sales', 'manager', 'admin']
const ROLE_LABEL = { sales: '👤 Sales', manager: '🧑‍💼 Manager', admin: '👑 Admin' }

const STAGE_LABEL = {
  visited:         { label: 'Visited',    cls: 'bg-brand-100 text-brand-700'  },
  pain_identified: { label: 'Pain Done',  cls: 'bg-purple-100 text-purple-700'  },
  roi_shown:       { label: 'ROI Shown',  cls: 'bg-blue-100 text-blue-700'      },
  login_started:   { label: 'Login Done', cls: 'bg-green-100 text-green-700'    },
  approved:        { label: 'Approved',   cls: 'bg-emerald-100 text-emerald-700' },
  disbursed:       { label: 'Disbursed',  cls: 'bg-teal-100 text-teal-700'      },
}

export default function S_AdminPanel() {
  const { closeAdminPanel, profile: myProfile } = useApp()
  const [profiles,      setProfiles]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [tab,           setTab]           = useState('pending')
  const [allLeads,      setAllLeads]      = useState([])
  const [leadsLoading,  setLeadsLoading]  = useState(false)
  const [expandedLead,  setExpandedLead]  = useState(null)
  const [filterBy,      setFilterBy]      = useState('all') // 'all' | 'unassigned' | profileId

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'leads') loadLeads() }, [tab])

  async function load() {
    setLoading(true); setError(null)
    try { setProfiles(await getAllProfiles()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleApprove(userId) {
    setError(null)
    try {
      await approveUser(userId)
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_approved: true } : p))
    } catch (err) { setError(err.message) }
  }

  async function loadLeads() {
    setLeadsLoading(true); setError(null)
    try { setAllLeads(await getAllCustomersAdmin()) }
    catch (err) { setError(err.message) }
    finally { setLeadsLoading(false) }
  }

  async function handleAssign(customerId, profileId) {
    setError(null)
    try {
      await assignCustomer(customerId, profileId)
      setAllLeads(prev => prev.map(l =>
        l.customer_id === customerId ? { ...l, assigned_to: profileId } : l
      ))
      setExpandedLead(null)
    } catch (err) { setError(err.message) }
  }

  async function handleRoleChange(userId, role) {
    setError(null)
    try {
      await updateProfile(userId, { role })
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p))
    } catch (err) { setError(err.message) }
  }

  const pending  = profiles.filter(p => !p.is_approved)
  const approved = profiles.filter(p => p.is_approved)
  const shown    = tab === 'pending' ? pending : approved

  // ── Leads filter ────────────────────────────────────────────────────────────
  const filteredLeads = allLeads.filter(l => {
    if (filterBy === 'all')        return true
    if (filterBy === 'unassigned') return !l.assigned_to
    return l.assigned_to === filterBy
  })

  // Build chip list: All + users who have ≥1 lead + Unassigned (if any)
  const assigneeCounts = {}
  let unassignedCount  = 0
  allLeads.forEach(l => {
    if (l.assigned_to) assigneeCounts[l.assigned_to] = (assigneeCounts[l.assigned_to] || 0) + 1
    else               unassignedCount++
  })
  const filterChips = [
    { key: 'all',        label: 'All',         count: allLeads.length },
    ...approved
      .filter(p => assigneeCounts[p.id])
      .map(p => ({ key: p.id, label: p.fullname, count: assigneeCounts[p.id] })),
    ...(unassignedCount > 0 ? [{ key: 'unassigned', label: 'Unassigned', count: unassignedCount }] : []),
  ]

  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0 flex items-center justify-between border-b border-slate-100">
        <div>
          <img
            src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png"
            alt="AR Financiers"
            className="h-6 w-auto object-contain mb-1"
          />
          <h1 className="text-lg font-extrabold mt-0.5">👑 Admin Panel</h1>
        </div>
        <button
          onClick={closeAdminPanel}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-slate-200 flex-shrink-0">
        {[
          ['pending', `Pending (${pending.length})`],
          ['users',   `Users (${approved.length})`],
          ['leads',   `Leads`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all
              ${tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-10">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-600">⚠️ {error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Load ho raha hai...</p>
          </div>
        )}

        {!loading && tab !== 'leads' && shown.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
            <p className="text-3xl mb-2">{tab === 'pending' ? '✅' : '👥'}</p>
            <p className="text-sm font-bold text-slate-500">
              {tab === 'pending' ? 'Koi pending user nahi' : 'Koi approved user nahi'}
            </p>
          </div>
        )}

        {/* ── LEADS TAB ── */}
        {tab === 'leads' && (
          <>
            {leadsLoading && (
              <div className="flex items-center justify-center gap-2 py-8">
                <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-400">Load ho raha hai...</p>
              </div>
            )}

            {/* Filter chips */}
            {!leadsLoading && allLeads.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {filterChips.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setFilterBy(chip.key)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95
                      ${filterBy === chip.key
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {chip.label}
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full
                      ${filterBy === chip.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {chip.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!leadsLoading && allLeads.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm font-bold text-slate-500">Koi lead nahi mili</p>
              </div>
            )}

            {!leadsLoading && allLeads.length > 0 && filteredLeads.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm font-bold text-slate-500">
                  {filterBy === 'unassigned'
                    ? 'Koi unassigned lead nahi'
                    : `${filterChips.find(c => c.key === filterBy)?.label || 'Is user'} ke koi leads nahi`}
                </p>
              </div>
            )}

            {filteredLeads.map(lead => {
              const assignee     = approved.find(p => p.id === lead.assigned_to)
              const isExpanded   = expandedLead === lead.customer_id
              const stageInfo    = STAGE_LABEL[lead.stage] || STAGE_LABEL.visited
              return (
                <div key={lead.customer_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Lead info row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-extrabold text-brand-600 flex-shrink-0">
                      {(lead.shop_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-slate-800 truncate">{lead.shop_name || 'Unknown'}</p>
                      {lead.owner_name && <p className="text-xs text-slate-400 truncate">{lead.owner_name}</p>}
                      {lead.mobile    && <p className="text-[10px] text-slate-400">📞 {lead.mobile}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageInfo.cls}`}>
                        {stageInfo.label}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  {/* Assignee row + assign button */}
                  <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">Assigned:</span>
                      <span className={`text-[11px] font-bold truncate ${assignee ? 'text-brand-600' : 'text-slate-400'}`}>
                        {assignee ? assignee.fullname : '— Unassigned'}
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedLead(isExpanded ? null : lead.customer_id)}
                      className="flex-shrink-0 text-xs font-bold text-brand-600 border border-brand-200 bg-white rounded-lg px-3 py-1.5 active:scale-95 transition-all"
                    >
                      {isExpanded ? 'Cancel' : 'Assign →'}
                    </button>
                  </div>

                  {/* User picker — dropdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <select
                        defaultValue={lead.assigned_to || ''}
                        onChange={e => handleAssign(lead.customer_id, e.target.value || null)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 bg-white outline-none focus:border-brand-400 appearance-none"
                      >
                        <option value=''>Choose Assignee</option>
                        {approved.map(p => (
                          <option key={p.id} value={p.id}>{p.fullname}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {tab !== 'leads' && shown.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Identity row */}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-extrabold text-brand-600 flex-shrink-0">
                {(p.fullname || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">
                  {p.fullname}
                  {p.id === myProfile?.id && (
                    <span className="ml-2 text-[10px] font-bold text-brand-500 bg-white px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">📞 {p.mobile}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Joined {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {!p.is_approved && (
                <button
                  onClick={() => handleApprove(p.id)}
                  className="flex-shrink-0 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-green-200"
                >
                  Approve ✓
                </button>
              )}
            </div>

            {/* Role picker — only for approved users */}
            {p.is_approved && (
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 w-8 flex-shrink-0">Role</span>
                <div className="flex gap-1.5 flex-wrap">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => p.id !== myProfile?.id ? handleRoleChange(p.id, r) : undefined}
                      disabled={p.id === myProfile?.id}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all
                        disabled:opacity-60 disabled:cursor-not-allowed
                        ${p.role === r
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 active:scale-95'}`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
