import { useApp } from '../context/AppContext'
import { getCurrentUser } from '../lib/db/dashboard'
import { signOut } from '../lib/auth'

const STAGE_CONFIG = {
  visited:         { label: 'Visited',    bg: 'bg-brand-100',  text: 'text-brand-700',  dot: 'bg-brand-500'  },
  pain_identified: { label: 'Pain Done',  bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
  roi_shown:       { label: 'ROI Shown',  bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  login_started:   { label: 'Login Done', bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500'   },
  approved:        { label: 'Approved',   bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  disbursed:       { label: 'Disbursed',  bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500'    },
}

export default function S_Home() {
  const {
    openQuickCreate, openDashboard,
    activeCustomer, setMainScreen, clearActiveCustomer,
    profile, openAdminPanel,
  } = useApp()

  const salesman = getCurrentUser()
  const stage    = activeCustomer ? (STAGE_CONFIG[activeCustomer.stage] || STAGE_CONFIG.visited) : null

  async function handleSignOut() {
    try { await signOut() } catch (_) {}
  }

  return (
    <div className="phone-shell flex flex-col bg-white" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <img
            src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png"
            alt="AR Financiers"
            className="h-9 w-auto object-contain"
          />
          {salesman && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500 font-medium">Namaste, {salesman} 👋</p>
              <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-sm font-extrabold text-white">
                {salesman.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
        <h1 className="text-xl font-extrabold text-slate-800 mt-3">Aaj Kya Karein?</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 pb-10">

        {/* Resume card */}
        {activeCustomer && (
          <div className="bg-white border border-brand-200 rounded-2xl shadow-sm shadow-brand-100 overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Active Lead</p>
            </div>
            <button
              onClick={() => setMainScreen('workspace')}
              className="w-full flex items-center gap-3 px-4 py-3 active:bg-white transition-all text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0 shadow-sm shadow-brand-200">
                {(activeCustomer.shopName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">{activeCustomer.shopName}</p>
                {activeCustomer.ownerName && (
                  <p className="text-xs text-slate-400 truncate">{activeCustomer.ownerName}</p>
                )}
                {activeCustomer.city && (
                  <p className="text-xs text-slate-400 truncate">{activeCustomer.city}</p>
                )}
                {stage && (
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${stage.bg} ${stage.text}`}>
                    {stage.label}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl">
                Resume →
              </div>
            </button>
            <div className="border-t border-slate-100 px-4 py-2.5 flex justify-end">
              <button
                onClick={clearActiveCustomer}
                className="text-[10px] font-semibold text-slate-400 active:text-red-400 transition-colors"
              >
                ✕ Clear Active Lead
              </button>
            </div>
          </div>
        )}

        {/* Section label */}
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 pt-1">
          Kya Karna Hai?
        </p>

        {/* Nayi Lead */}
        <button
          onClick={openQuickCreate}
          className="w-full bg-accent-400 text-white rounded-2xl px-5 py-5 flex items-center gap-4 shadow-lg shadow-accent-200 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
            🏪
          </div>
          <div className="flex-1">
            <p className="text-base font-extrabold">Nayi Lead Banao</p>
            <p className="text-xs text-brand-200 mt-0.5">Naye customer ka record banao</p>
          </div>
          <span className="text-brand-400 text-xl flex-shrink-0">›</span>
        </button>

        {/* Existing Lead */}
        <button
          onClick={openDashboard}
          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-5 flex items-center gap-4 shadow-sm active:bg-white active:scale-[0.98] transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
            📋
          </div>
          <div className="flex-1">
            <p className="text-base font-extrabold text-slate-800">Existing Lead Pe Kaam</p>
            <p className="text-xs text-slate-500 mt-0.5">Purani leads dekho aur aage badhao</p>
          </div>
          <span className="text-slate-300 text-xl flex-shrink-0">›</span>
        </button>

        {/* Follow-ups */}
        <button
          onClick={() => openDashboard('followups')}
          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-5 flex items-center gap-4 shadow-sm active:bg-white active:scale-[0.98] transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
            📅
          </div>
          <div className="flex-1">
            <p className="text-base font-extrabold text-slate-800">Follow-ups</p>
            <p className="text-xs text-slate-500 mt-0.5">Aaj kis customer ko call/visit karna hai</p>
          </div>
          <span className="text-slate-300 text-xl flex-shrink-0">›</span>
        </button>

        {/* Tips strip */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4">
          <p className="text-xs font-bold text-amber-700 mb-2">💡 Aaj Ka Target</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-700">Har customer ka Pain Discovery bharo</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-700">ROI tool se loan ka faida dikhao</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-700">File login karwa ke stage aage badhao</p>
            </div>
          </div>
        </div>

        {/* Admin panel — only visible to admins */}
        {profile?.role === 'admin' && (
          <button
            onClick={openAdminPanel}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm active:bg-white active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl flex-shrink-0">
              👑
            </div>
            <div className="flex-1">
              <p className="text-sm font-extrabold text-slate-800">Admin Panel</p>
              <p className="text-xs text-slate-500 mt-0.5">Users approve karo, roles manage karo</p>
            </div>
            <span className="text-slate-300 text-xl flex-shrink-0">›</span>
          </button>
        )}

        {/* Sign out */}
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleSignOut}
            className="text-xs font-semibold text-slate-400 active:text-slate-600 transition-colors"
          >
            Logout — {salesman}
          </button>
        </div>

      </div>
    </div>
  )
}
