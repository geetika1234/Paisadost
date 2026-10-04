import { useCallback, useEffect, useRef, useState } from 'react'
import { getLeadDetail, bulkAssign } from '../../lib/db/admin'
import { changeLeadStatus } from '../../lib/db/status'
import { friendlyDbError } from '../../lib/db/errors'
import { STAGES, STATUSES, getStage, getStatus, hasReachedStage } from '../../logic/stages'
import StoredPhoto from '../../components/StoredPhoto'
import { StageChip, StatusChip, formatDate, ErrorBanner, Spinner } from '../ui'

const TABS = [
  ['summary',   'Summary'],
  ['activity',  'Activity'],
  ['changes',   'Stage / status'],
  ['followups', 'Follow-ups'],
]

const EVENT_LABEL = {
  lead_created:     'Lead bani',
  visit_done:       'Visit',
  pain_identified:  'Pain discovery',
  roi_shown:        'ROI dikhaya',
  login_started:    'File login',
  customer_response:'Customer response',
  note_added:       'Note',
  loan_requirement: 'Loan requirement',
  status_changed:   'Status badla',
}

const RESPONSE_LABEL = { interested: 'Interested', thinking: 'Soch Raha', not_interested: 'Nahi' }

/**
 * Right-hand panel for one lead. A dialog: Esc or the backdrop closes it and
 * focus returns to where it was. Changes go through the same rules as the
 * mobile app (status via status_changed events, owner via RLS-checked update).
 */
export default function LeadDrawer({ customerId, agents, actorName, onClose, onChanged }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('summary')
  const closeRef  = useRef(null)
  const returnTo  = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setDetail(await getLeadDetail(customerId)) }
    catch (err) { setError(friendlyDbError(err, 'Lead load nahi hui.')) }
    finally { setLoading(false) }
  }, [customerId])

  useEffect(() => { setTab('summary'); load() }, [load])

  // Focus in on open, back out on close; Esc closes. onClose is read through a
  // ref so a new callback identity from the parent does not re-run this.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    returnTo.current = document.activeElement
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      returnTo.current?.focus?.()
    }
  }, [])

  function afterChange() { load(); onChanged() }

  const lead = detail?.lead

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-xl flex flex-col"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-slate-200">
          <div className="min-w-0">
            <h2 id="lead-drawer-title" className="text-lg font-bold text-slate-900 truncate">
              {lead?.shop_name || (loading ? 'Load ho raha hai…' : 'Lead')}
            </h2>
            {lead && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StageChip stage={lead.stage} />
                <StatusChip status={lead.status} reason={lead.status_reason} />
              </div>
            )}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Band karein"
            className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 text-xl leading-none">×</button>
        </header>

        <nav aria-label="Lead sections" className="flex gap-1 px-4 border-b border-slate-200">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading && !detail && <Spinner />}
          {detail && tab === 'summary'   && <Summary detail={detail} agents={agents} actorName={actorName} onChanged={afterChange} />}
          {detail && tab === 'activity'  && <Activity events={detail.events} />}
          {detail && tab === 'changes'   && <Changes history={detail.history} />}
          {detail && tab === 'followups' && <Followups reminders={detail.reminders} />}
        </div>
      </aside>
    </div>
  )
}

// ── Summary ──────────────────────────────────────────────────────────────────

function Summary({ detail, agents, actorName, onChanged }) {
  const { lead, events } = detail
  const latestVisit = events.find(e => e.event_type === 'visit_done')
  const photos = Array.isArray(latestVisit?.data?.photoUrls) ? latestVisit.data.photoUrls : []
  const reached = STAGES.filter(s => hasReachedStage(lead.stage, s.key))

  return (
    <>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-slate-500">Owner</dt>     <dd className="text-slate-900">{lead.owner_name || '—'}</dd>
        <dt className="text-slate-500">Mobile</dt>    <dd className="text-slate-900">{lead.mobile || '—'}</dd>
        <dt className="text-slate-500">Area</dt>      <dd className="text-slate-900">{[lead.area, lead.landmark].filter(Boolean).join(' · ') || '—'}</dd>
        <dt className="text-slate-500">Agent</dt>     <dd className="text-slate-900">{lead.assignee_name || 'Bina owner'}</dd>
        <dt className="text-slate-500">Bani</dt>      <dd className="text-slate-900">{formatDate(lead.created_at, true)}</dd>
        <dt className="text-slate-500">Last activity</dt><dd className="text-slate-900">{formatDate(lead.last_activity_at, true)}</dd>
        <dt className="text-slate-500">Agla follow-up</dt>
        <dd className={lead.followup_overdue ? 'text-red-600 font-semibold' : 'text-slate-900'}>
          {lead.next_followup_at ? formatDate(lead.next_followup_at, true) : '—'}{lead.followup_overdue ? ' (overdue)' : ''}
        </dd>
      </dl>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage progress</h3>
        <ol className="mt-2 flex items-center gap-1" aria-label={`Stage: ${getStage(lead.stage).label}`}>
          {STAGES.map((s, i) => {
            const done = reached.some(r => r.key === s.key)
            return (
              <li key={s.key} className="flex-1">
                <span className={`block h-1.5 rounded-full ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />
                <span className={`mt-1 block text-[11px] ${done ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                  {i + 1}. {s.label}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-slate-500">Stage agent ke kaam se apne aap badhta hai (visit, pain, ROI, file login).</p>
      </div>

      {photos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit photos</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <StoredPhoto key={src} src={src} alt={`Visit photo ${i + 1}`}
                className="w-full aspect-[3/4] object-cover rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      )}

      <ReassignForm lead={lead} agents={agents} onChanged={onChanged} />
      <StatusForm lead={lead} actorName={actorName} onChanged={onChanged} />
    </>
  )
}

function ReassignForm({ lead, agents, onChanged }) {
  const [agent,  setAgent]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const [msg,    setMsg]    = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!agent || busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await bulkAssign([lead.customer_id], agent)
      if (res.failed.length) throw new Error('Assign nahi hua. Shayad aapke paas permission nahi hai.')
      setAgent('')
      setMsg({ ok: true, text: 'Agent badal diya.' })
      onChanged()
    } catch (err) {
      setMsg({ ok: false, text: friendlyDbError(err) })
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">Agent badlein</h3>
      <div className="mt-2 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Naya agent</span>
          <select value={agent} onChange={e => setAgent(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
            <option value="">Agent chunein</option>
            {agents.filter(a => a.id !== lead.assigned_to).map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!agent || busy}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-40">
          {busy ? '…' : 'Assign'}
        </button>
      </div>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  )
}

const STATUS_REASON_HINTS = {
  active:        ['Customer wapas interested hai', 'Galti se band hui thi'],
  nurture:       ['Abhi nahi, 2-3 mahine baad', 'Season ke baad'],
  not_qualified: ['Business bahut chhota hai', 'Purana loan default hai', 'Documents nahi hain'],
  lost:          ['Doosre lender se loan le liya', 'Dukaan band ho gayi', 'Customer ne mana kar diya'],
  rejected:      ['Lender ne file reject ki'],
  dormant:       ['60+ din se koi activity nahi'],
}

function StatusForm({ lead, actorName, onChanged }) {
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [msg,    setMsg]    = useState(null)
  const canReject = hasReachedStage(lead.stage, 'login_started')

  async function submit(e) {
    e.preventDefault()
    if (!status || !reason.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const settled = await changeLeadStatus(lead.customer_id, { status, reason }, actorName)
      setStatus(''); setReason('')
      setMsg({ ok: true, text: `Status ab ${getStatus(settled.status).label} hai.` })
      onChanged()
    } catch (err) {
      setMsg({ ok: false, text: friendlyDbError(err) })
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 pt-5 space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">Status badlein</h3>
      <p className="text-xs text-slate-500">Abhi: {getStatus(lead.status).label}{lead.status_reason ? ` · ${lead.status_reason}` : ''}</p>
      <label className="block">
        <span className="sr-only">Naya status</span>
        <select value={status} onChange={e => { setStatus(e.target.value); setReason('') }}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
          <option value="">Naya status chunein</option>
          {STATUSES.filter(s => s.key !== lead.status).map(s => (
            <option key={s.key} value={s.key} disabled={s.key === 'rejected' && !canReject}>
              {s.label}{s.key === 'rejected' && !canReject ? ' (Login Done ke baad)' : ''}
            </option>
          ))}
        </select>
      </label>
      {status && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Reason (zaroori)</span>
            <input value={reason} onChange={e => setReason(e.target.value.slice(0, 300))} required
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(STATUS_REASON_HINTS[status] || []).map(h => (
              <button key={h} type="button" onClick={() => setReason(h)}
                className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">{h}</button>
            ))}
          </div>
          <button type="submit" disabled={!reason.trim() || busy}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-40">
            {busy ? 'Save ho raha hai…' : `Status ${getStatus(status).label} karein`}
          </button>
        </>
      )}
      {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  )
}

// ── Other tabs ───────────────────────────────────────────────────────────────

function Activity({ events }) {
  if (!events.length) return <p className="text-sm text-slate-600">Abhi koi activity nahi.</p>
  return (
    <ol className="space-y-3">
      {events.map(e => (
        <li key={e.event_id} className="text-sm">
          <p className="font-medium text-slate-900">
            {EVENT_LABEL[e.event_type] || e.event_type}
            {e.event_type === 'customer_response' && e.data?.response && `: ${RESPONSE_LABEL[e.data.response] || e.data.response}`}
            {e.event_type === 'status_changed' && e.data?.status && ` → ${getStatus(e.data.status).label}`}
          </p>
          {e.event_type === 'note_added'     && e.data?.text   && <p className="text-slate-700">{e.data.text}</p>}
          {e.event_type === 'status_changed' && e.data?.reason && <p className="text-slate-700">{e.data.reason}{e.data.note ? ` · ${e.data.note}` : ''}</p>}
          <p className="text-xs text-slate-500">{e.salesman_id || '—'} · {formatDate(e.created_at, true)}</p>
        </li>
      ))}
    </ol>
  )
}

function Changes({ history }) {
  if (!history.length) return <p className="text-sm text-slate-600">Koi badlav record nahi.</p>
  return (
    <ol className="space-y-3">
      {history.map(h => {
        const stageMoved  = h.from_stage !== h.to_stage
        const statusMoved = h.from_status !== h.to_status && h.to_status
        return (
          <li key={h.id} className="text-sm">
            {stageMoved && (
              <p className="text-slate-900">
                Stage: {h.from_stage ? getStage(h.from_stage).label : 'Shuru'} → <span className="font-medium">{getStage(h.to_stage).label}</span>
                {h.skipped_steps?.length > 0 && (
                  <span className="text-xs text-slate-500"> (chhoda: {h.skipped_steps.map(k => getStage(k).label).join(', ')})</span>
                )}
              </p>
            )}
            {statusMoved && (
              <p className="text-slate-900">
                Status: {h.from_status ? getStatus(h.from_status).label : '—'} → <span className="font-medium">{getStatus(h.to_status).label}</span>
              </p>
            )}
            {!stageMoved && !statusMoved && <p className="text-slate-900">{h.reason === 'backfill' ? 'Purana record (shuruaati stage)' : 'Badlav'}</p>}
            {h.reason && h.reason !== 'backfill' && <p className="text-slate-700">{h.reason}</p>}
            <p className="text-xs text-slate-500">{formatDate(h.changed_at, true)}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Followups({ reminders }) {
  if (!reminders.length) return <p className="text-sm text-slate-600">Koi follow-up nahi.</p>
  const now = Date.now()
  return (
    <ol className="space-y-3">
      {reminders.map(r => {
        const overdue = r.status === 'pending' && new Date(r.due_at).getTime() < now
        return (
          <li key={r.reminder_id} className="text-sm">
            <p className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
              {formatDate(r.due_at, true)} · {r.status === 'done' ? 'Ho gaya' : overdue ? 'Overdue' : 'Pending'}
            </p>
            {r.note && <p className="text-slate-700">{r.note}</p>}
            {r.completion_note && <p className="text-slate-600">Result: {r.completion_note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
