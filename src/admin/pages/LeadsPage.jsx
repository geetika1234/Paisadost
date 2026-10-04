import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import {
  listLeadsPage, fetchAllLeads, toCsv, logAdminAction, bulkAssign, bulkSetStatus, listTeam,
  PAGE_SIZE, BULK_LIMIT, EXPORT_LIMIT, DORMANT_DAYS, SORTS,
} from '../../lib/db/admin'
import { friendlyDbError } from '../../lib/db/errors'
import { STAGES, STATUSES } from '../../logic/stages'
import { filtersFromParams, paramsFromFilters, hasActiveFilters } from '../leadFilters'
import { useDocumentTitle, StageChip, StatusChip, formatDate, relativeDays, ErrorBanner } from '../ui'
import LeadDrawer from '../components/LeadDrawer'

const SEARCH_DEBOUNCE_MS = 300

export default function LeadsPage() {
  useDocumentTitle('Leads')
  const { profile } = useApp()
  const [params, setParams] = useSearchParams()

  const filters    = useMemo(() => filtersFromParams(params), [params])
  const page       = Math.max(0, parseInt(params.get('page') || '0', 10) || 0)
  const openLeadId = params.get('lead')
  // Reload the table only when filters/page change, not when the drawer opens.
  const queryKey   = paramsFromFilters(filters, { page: page ? String(page) : '' }).toString()

  const [rows,     setRows]     = useState([])
  const [total,    setTotal]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [reload,   setReload]   = useState(0)
  const [team,     setTeam]     = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [notice,   setNotice]   = useState(null)       // { tone: 'ok' | 'warn' | 'error', text }
  const requestId = useRef(0)

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = ++requestId.current
    setLoading(true); setError(null)
    listLeadsPage(filters, page)
      .then(res => { if (id === requestId.current) { setRows(res.rows); setTotal(res.total) } })
      .catch(err => { if (id === requestId.current) setError(friendlyDbError(err, 'Leads load nahi hui.')) })
      .finally(() => { if (id === requestId.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reload])

  useEffect(() => { setSelected(new Set()) }, [queryKey])

  useEffect(() => {
    listTeam().then(setTeam).catch(() => setTeam([]))
  }, [])

  const refresh = useCallback(() => setReload(n => n + 1), [])

  // ── URL helpers ───────────────────────────────────────────────────────────
  function updateFilters(patch) {
    setParams(paramsFromFilters({ ...filters, ...patch }))   // resets page, closes drawer
  }
  function setPage(n) {
    const p = paramsFromFilters(filters, { page: n > 0 ? String(n) : '' })
    setParams(p)
  }
  function openLead(id) {
    const p = new URLSearchParams(params); p.set('lead', id); setParams(p)
  }
  function closeLead() {
    const p = new URLSearchParams(params); p.delete('lead'); setParams(p)
  }

  // ── Search box (debounced into the URL) ──────────────────────────────────
  const [searchDraft, setSearchDraft] = useState(filters.search)
  useEffect(() => { setSearchDraft(filters.search) }, [filters.search])
  useEffect(() => {
    if (searchDraft === filters.search) return
    const t = setTimeout(() => updateFilters({ search: searchDraft }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  // ── Selection ─────────────────────────────────────────────────────────────
  const pageIds     = rows.map(r => r.customer_id)
  const allOnPage   = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < BULK_LIMIT) next.add(id)
      return next
    })
  }
  function toggleAllOnPage() {
    setSelected(allOnPage ? new Set() : new Set(pageIds.slice(0, BULK_LIMIT)))
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(null)   // null | number fetched so far
  async function handleExport() {
    if (exporting !== null) return
    setExporting(0); setNotice(null)
    try {
      const all = await fetchAllLeads(filters, n => setExporting(n))
      if (all.length === 0) { setNotice({ tone: 'warn', text: 'Export ke liye koi lead nahi.' }); return }
      const blob = new Blob([toCsv(all)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      await logAdminAction('leads_exported', { count: all.length, filters }).catch(() => {})
      setNotice({
        tone: all.length >= EXPORT_LIMIT ? 'warn' : 'ok',
        text: all.length >= EXPORT_LIMIT
          ? `Pehli ${EXPORT_LIMIT} leads export hui. Baaki ke liye filter lagayein.`
          : `${all.length} leads export hui.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', text: `Export adhoora reh gaya: ${friendlyDbError(err)}` })
    } finally {
      setExporting(null)
    }
  }

  const agents   = team.filter(t => t.role === 'sales' || t.role === 'manager' || t.role === 'admin')
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd   = page * PAGE_SIZE + rows.length
  const lastPage   = total != null ? Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) : page
  const filtered   = hasActiveFilters(filters)

  return (
    <section aria-labelledby="page-title" className="space-y-4 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="page-title" className="text-xl font-bold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">
            {total == null ? ' ' : `${total.toLocaleString('en-IN')} leads${filtered ? ' (filtered)' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting !== null || loading}
          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting !== null ? `Export ho raha hai… ${exporting.toLocaleString('en-IN')}` : 'Export CSV'}
        </button>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <form role="search" onSubmit={e => e.preventDefault()} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[16rem]">
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search: dukaan, malik ya mobile"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-brand-600"
            />
          </label>
          <Select label="Stage" value={filters.stage} onChange={v => updateFilters({ stage: v })}
            options={[['all', 'Saare stages'], ...STAGES.map(s => [s.key, s.label])]} />
          <Select label="Status" value={filters.status} onChange={v => updateFilters({ status: v })}
            options={[['open', 'Chalu (Active + Nurture)'], ['closed', 'Band'], ['all', 'Saare status'], ...STATUSES.map(s => [s.key, s.label])]} />
          <Select label="Agent" value={filters.assignee} onChange={v => updateFilters({ assignee: v })}
            options={[['all', 'Saare agents'], ['none', 'Bina owner'], ...agents.map(a => [a.id, a.fullname])]} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Area
            <input
              type="text"
              defaultValue={filters.area}
              key={filters.area}
              onBlur={e => e.target.value.trim() !== filters.area && updateFilters({ area: e.target.value.trim() })}
              onKeyDown={e => { if (e.key === 'Enter') updateFilters({ area: e.currentTarget.value.trim() }) }}
              placeholder="e.g. Jaipur"
              className="mt-1 block w-40 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-brand-600"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Bani (se)
            <input type="date" value={filters.from} onChange={e => updateFilters({ from: e.target.value })}
              className="mt-1 block px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Bani (tak)
            <input type="date" value={filters.to} onChange={e => updateFilters({ to: e.target.value })}
              className="mt-1 block px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <Check label={`${DORMANT_DAYS}+ din se activity nahi`} checked={filters.inactive} onChange={v => updateFilters({ inactive: v })} />
          <Check label="Overdue follow-up" checked={filters.overdue} onChange={v => updateFilters({ overdue: v })} />
          <Select label="Sort" value={filters.sort} onChange={v => updateFilters({ sort: v })}
            options={Object.entries(SORTS).map(([k, s]) => [k, s.label])} />
          {filtered && (
            <button type="button" onClick={() => setParams(new URLSearchParams())}
              className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2">
              Filters hatayein
            </button>
          )}
        </div>
      </form>

      {notice && (
        <div role="status" className={`text-sm rounded-lg px-4 py-2 border ${
          notice.tone === 'ok' ? 'bg-green-50 border-green-200 text-green-800'
          : notice.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-red-50 border-red-200 text-red-700'}`}>
          {notice.text}
        </div>
      )}
      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm" aria-busy={loading}>
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <input type="checkbox" aria-label="Is page ki saari leads chunein"
                  checked={allOnPage} onChange={toggleAllOnPage} disabled={!rows.length} />
              </th>
              <th scope="col" className="px-3 py-2">Shop / Owner</th>
              <th scope="col" className="px-3 py-2">Mobile</th>
              <th scope="col" className="px-3 py-2">Area</th>
              <th scope="col" className="px-3 py-2">Stage</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Agent</th>
              <th scope="col" className="px-3 py-2">Agla follow-up</th>
              <th scope="col" className="px-3 py-2">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
              <tr key={`sk-${i}`} aria-hidden="true">
                <td colSpan={9} className="px-3 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              </tr>
            ))}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-600">
                  {filtered ? (
                    <>Is filter se koi lead nahi.{' '}
                      <button type="button" onClick={() => setParams(new URLSearchParams())} className="font-semibold text-brand-600 underline underline-offset-2">Filters hatayein</button>
                    </>
                  ) : 'Abhi koi lead nahi. Agents Quick Create se leads banayenge.'}
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.customer_id}
                className={`hover:bg-slate-50 ${selected.has(r.customer_id) ? 'bg-brand-50' : ''} ${loading ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`${r.shop_name || 'Lead'} chunein`}
                    checked={selected.has(r.customer_id)} onChange={() => toggle(r.customer_id)} />
                </td>
                <td className="px-3 py-2 max-w-[16rem]">
                  <button type="button" onClick={() => openLead(r.customer_id)}
                    className="block text-left w-full rounded focus-visible:outline-2">
                    <span className="block font-semibold text-slate-900 truncate hover:underline">{r.shop_name || 'Unknown'}</span>
                    {r.owner_name && <span className="block text-xs text-slate-500 truncate">{r.owner_name}</span>}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.mobile || '—'}</td>
                <td className="px-3 py-2 max-w-[10rem] truncate">{r.area || '—'}</td>
                <td className="px-3 py-2"><StageChip stage={r.stage} /></td>
                <td className="px-3 py-2"><StatusChip status={r.status} reason={r.status_reason} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{r.assignee_name || <span className="text-amber-700">Bina owner</span>}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${r.followup_overdue ? 'text-red-600 font-semibold' : ''}`}>
                  {r.next_followup_at ? formatDate(r.next_followup_at) : '—'}
                  {r.followup_overdue && <span className="sr-only"> (overdue)</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{relativeDays(r.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {total != null && total > 0 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm text-slate-600">
          <span>{rangeStart.toLocaleString('en-IN')}–{rangeEnd.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40">← Pichla</button>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page >= lastPage || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40">Agla →</button>
          </div>
        </nav>
      )}

      {selected.size > 0 && (
        <BulkBar
          selectedIds={[...selected]}
          agents={agents}
          actorName={profile?.fullname}
          onClear={() => setSelected(new Set())}
          onDone={(result, text) => {
            setNotice(result)
            if (text !== 'keep') setSelected(new Set())
            refresh()
          }}
          onPartial={failedIds => setSelected(new Set(failedIds))}
        />
      )}

      {openLeadId && (
        <LeadDrawer
          customerId={openLeadId}
          agents={agents}
          actorName={profile?.fullname}
          onClose={closeLead}
          onChanged={refresh}
        />
      )}
    </section>
  )
}

// ── Bulk action bar ──────────────────────────────────────────────────────────

function BulkBar({ selectedIds, agents, actorName, onClear, onDone, onPartial }) {
  const [assignee, setAssignee] = useState('')
  const [mode,     setMode]     = useState(null)            // null | 'dormant'
  const [reason,   setReason]   = useState(`${DORMANT_DAYS}+ din se koi activity nahi`)
  const [busy,     setBusy]     = useState(false)
  const n = selectedIds.length

  async function run(action) {
    if (busy) return
    setBusy(true)
    try {
      const res = await action()
      const ok = res.succeeded.length
      const failedIds = res.failed.map(f => (typeof f === 'string' ? f : f.id))
      if (failedIds.length) {
        onPartial(failedIds)
        onDone({ tone: 'warn', text: `${ok} ho gayi, ${failedIds.length} nahi hui. Jo nahi hui woh chuni hui hain.` }, 'keep')
      } else {
        onDone({ tone: 'ok', text: `${ok} leads update ho gayi.` })
      }
      setMode(null)
    } catch (err) {
      onDone({ tone: 'error', text: friendlyDbError(err) }, 'keep')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="region" aria-label="Chuni hui leads par action"
      className="fixed bottom-0 right-0 left-56 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] px-8 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-slate-900">{n} chuni hui{n >= BULK_LIMIT ? ` (max ${BULK_LIMIT})` : ''}</span>

        {mode === null && (
          <>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Assign to</span>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm">
                <option value="">Agent chunein</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
              </select>
            </label>
            <button type="button" disabled={!assignee || busy}
              onClick={() => run(() => bulkAssign(selectedIds, assignee))}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-40">
              {busy ? 'Ho raha hai…' : 'Assign'}
            </button>
            <button type="button" onClick={() => setMode('dormant')} disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700">
              Mark Dormant…
            </button>
          </>
        )}

        {mode === 'dormant' && (
          <>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Reason</span>
              <input value={reason} onChange={e => setReason(e.target.value.slice(0, 300))}
                className="w-72 px-2 py-1.5 rounded-lg border border-slate-300 text-sm" />
            </label>
            <button type="button" disabled={!reason.trim() || busy}
              onClick={() => run(() => bulkSetStatus(selectedIds, { status: 'dormant', reason }, actorName))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold disabled:opacity-40">
              {busy ? 'Ho raha hai…' : `Haan, ${n} leads Dormant karein`}
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="text-slate-600 underline underline-offset-2">
              Cancel
            </button>
          </>
        )}

        <button type="button" onClick={onClear} disabled={busy} className="ml-auto text-slate-600 underline underline-offset-2">
          Selection hatayein
        </button>
      </div>
    </div>
  )
}

// ── Small controls ───────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 block px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 py-2">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
