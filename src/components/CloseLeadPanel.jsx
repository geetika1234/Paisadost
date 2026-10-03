import { useState } from 'react'
import { AGENT_CLOSE_REASONS } from '../logic/stages'
import { changeLeadStatus } from '../lib/db/status'
import { friendlyDbError } from '../lib/db/errors'

const CLOSE_OPTIONS = [
  { key: 'lost',          label: 'Lost',          hint: 'Customer ne kahin aur se liya / mana kiya' },
  { key: 'not_qualified', label: 'Not Qualified', hint: 'Hamare criteria mein fit nahi' },
]

/**
 * "Lead band karein": an agent closes their own lead as Lost or Not
 * Qualified with a reason. The database enforces who may do this (migration
 * 009); this panel only collects a valid request and shows the outcome.
 * Reopening a closed lead is an admin/manager action.
 */
export default function CloseLeadPanel({ customerId, salesman, onClosed }) {
  const [open,    setOpen]    = useState(false)
  const [status,  setStatus]  = useState(null)
  const [reason,  setReason]  = useState(null)
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  function reset() {
    setOpen(false); setStatus(null); setReason(null); setNote(''); setError(null)
  }

  async function handleConfirm() {
    if (!status || !reason || saving) return
    setSaving(true)
    setError(null)
    try {
      const settled = await changeLeadStatus(customerId, { status, reason, note }, salesman)
      onClosed?.({ status: settled.status, statusReason: settled.status_reason })
      reset()
    } catch (err) {
      setError(friendlyDbError(err, 'Lead band nahi hui. Dobara try karein.'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-2xl border border-red-200 bg-white text-red-600 text-sm font-bold active:scale-[0.98] transition-all"
      >
        Lead band karein
      </button>
    )
  }

  return (
    <section aria-labelledby="close-lead-title" className="bg-white border border-red-200 rounded-2xl px-4 py-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="close-lead-title" className="text-sm font-extrabold text-slate-800">Lead band karein</h2>
        <button onClick={reset} className="text-xs font-bold text-slate-400" aria-label="Band karna cancel karein">Cancel</button>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kyun band kar rahe hain">
        {CLOSE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            role="radio"
            aria-checked={status === opt.key}
            onClick={() => { setStatus(opt.key); setReason(null) }}
            className={`text-left rounded-xl border px-3 py-2.5 transition-all active:scale-95
              ${status === opt.key ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
          >
            <span className="block text-sm font-bold text-slate-800">{opt.label}</span>
            <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{opt.hint}</span>
          </button>
        ))}
      </div>

      {status && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reason (zaroori)</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {AGENT_CLOSE_REASONS[status].map(r => (
              <button
                key={r}
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={`text-xs font-bold px-3 py-2 rounded-full border transition-all active:scale-95
                  ${reason === r ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Note (optional)</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 300))}
              rows={2}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none resize-none focus:border-slate-400"
            />
          </label>
        </div>
      )}

      {error && <p role="alert" className="text-xs font-semibold text-red-600">⚠️ {error}</p>}

      <p className="text-[11px] text-slate-500">
        Band lead aapki list se hat jaayegi. Dobara kholne ke liye admin se baat karni hogi.
      </p>
      <button
        onClick={handleConfirm}
        disabled={!status || !reason || saving}
        className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
      >
        {saving ? 'Band ho rahi hai...' : 'Haan, lead band karo'}
      </button>
    </section>
  )
}
