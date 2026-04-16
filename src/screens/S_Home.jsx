import { useApp } from '../context/AppContext'
import { getCurrentUser } from '../lib/db/dashboard'

const STAGE_CONFIG = {
  visited:         { label: 'Visited',    bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
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
  } = useApp()

  const salesman = getCurrentUser()
  const stage    = activeCustomer ? (STAGE_CONFIG[activeCustomer.stage] || STAGE_CONFIG.visited) : null

  return (
    <div className="phone-shell flex flex-col bg-slate-50" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-8 px-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-[0.2em]">PaisaDost</p>
            <h1 className="text-2xl font-extrabold mt-0.5 leading-tight">Aaj Kya Karein?</h1>
          </div>
          {salesman && (
            <div className="w-10 h-10 rounded-full bg-indigo-500/60 flex items-center justify-center text-base font-extrabold">
              {salesman.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {salesman && (
          <p className="text-xs text-indigo-300 font-medium">Namaste, {salesman} 👋</p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 pb-10">

        {/* Resume card */}
        {activeCustomer && (
          <div className="bg-white border border-indigo-200 rounded-2xl shadow-sm shadow-indigo-100 overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Active Lead</p>
            </div>
            <button
              onClick={() => setMainScreen('workspace')}
              className="w-full flex items-center gap-3 px-4 py-3 active:bg-indigo-50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0 shadow-sm shadow-indigo-200">
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
              <div className="flex-shrink-0 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl">
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
          className="w-full bg-indigo-600 text-white rounded-2xl px-5 py-5 flex items-center gap-4 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
            🏪
          </div>
          <div className="flex-1">
            <p className="text-base font-extrabold">Nayi Lead Banao</p>
            <p className="text-xs text-indigo-200 mt-0.5">Naye customer ka record banao</p>
          </div>
          <span className="text-indigo-300 text-xl flex-shrink-0">›</span>
        </button>

        {/* Existing Lead */}
        <button
          onClick={openDashboard}
          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-5 flex items-center gap-4 shadow-sm active:bg-slate-50 active:scale-[0.98] transition-all text-left"
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

      </div>
    </div>
  )
}
