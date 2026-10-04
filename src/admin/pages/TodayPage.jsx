import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodaySummary, DORMANT_DAYS } from '../../lib/db/admin'
import { friendlyDbError } from '../../lib/db/errors'
import { getStage } from '../../logic/stages'
import { useDocumentTitle, ErrorBanner, Spinner } from '../ui'

/**
 * First screen of the console: what needs an admin decision now, then how
 * the month is going. Every number links to the list that fixes it.
 */
export default function TodayPage() {
  useDocumentTitle('Today')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await getTodaySummary()) }
    catch (err) { setError(friendlyDbError(err, 'Data load nahi hua.')) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const kpis = data?.kpis || {}
  const overdueTotal = (data?.overdue_by_agent || []).reduce((s, a) => s + a.count, 0)

  const queue = data ? [
    { key: 'pending',  count: data.pending_users,      text: 'users approval ka intezaar kar rahe hain', to: '/team',                     action: 'Review' },
    { key: 'unowned',  count: data.unowned_leads,      text: 'leads ka koi owner nahi hai',               to: '/leads?assignee=none',       action: 'Assign' },
    { key: 'overdue',  count: overdueTotal,            text: 'follow-ups overdue hain',                   to: '/leads?overdue=1&sort=followup_asc', action: 'Open' },
    { key: 'inactive', count: data.dormant_candidates, text: `leads mein ${DORMANT_DAYS}+ din se koi activity nahi`, to: '/leads?inactive=1&sort=activity_asc', action: 'Review' },
  ] : []
  const needsYou = queue.filter(q => q.count > 0)

  return (
    <section aria-labelledby="page-title" className="max-w-5xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 id="page-title" className="text-xl font-bold text-slate-900">Today</h1>
          <p className="mt-1 text-sm text-slate-500">Aaj kis cheez par aapka dhyan chahiye.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50">
          Refresh
        </button>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* KPI strip: one line of text, not tiles */}
      <dl className="flex flex-wrap gap-x-10 gap-y-3 border-y border-slate-200 py-4" aria-label="Is mahine">
        {[
          ['Nayi leads', kpis.new_leads],
          ['Visits',     kpis.visits],
          ['Logins',     kpis.logins],
          ['Band hui',   kpis.closed],
          ['Overdue follow-ups', data ? overdueTotal : undefined],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-slate-500">{label} <span className="sr-only">(is mahine)</span></dt>
            <dd className="text-2xl font-bold text-slate-900">{value ?? '–'}</dd>
          </div>
        ))}
        <p className="self-end text-xs text-slate-400">Is mahine ke numbers</p>
      </dl>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Aapka dhyan chahiye</h2>
        {loading && !data ? (
          <div className="mt-3"><Spinner /></div>
        ) : needsYou.length === 0 && data ? (
          <p className="mt-3 text-sm text-slate-600">Sab clear hai. Koi pending kaam nahi.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
            {needsYou.map(q => (
              <li key={q.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-slate-700">
                  <span className="font-bold text-slate-900">{q.count}</span> {q.text}
                </p>
                <Link to={q.to} className="text-sm font-semibold text-brand-600 hover:text-brand-700">{q.action}</Link>
              </li>
            ))}
          </ul>
        )}
        {(data?.overdue_by_agent || []).length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Overdue:{' '}
            {data.overdue_by_agent.map((a, i) => (
              <span key={a.agent_id || 'none'}>
                {i > 0 && ' · '}
                <Link
                  to={a.agent_id ? `/leads?assignee=${a.agent_id}&overdue=1&sort=followup_asc` : '/leads?assignee=none&overdue=1'}
                  className="underline underline-offset-2 hover:text-slate-800"
                >
                  {a.agent_name} ({a.count})
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>

      {data && <Funnel funnel={data.funnel || []} />}
      {data && <AgentTable agents={data.agents || []} />}
    </section>
  )
}

function Funnel({ funnel }) {
  const top = funnel[0]?.reached || 0
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Funnel · is mahine bani leads</h2>
      {top === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Is mahine abhi tak koi nayi lead nahi.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {funnel.map(step => {
            const pct = Math.round((step.reached / top) * 100)
            return (
              <li key={step.key} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-slate-700">{getStage(step.key).label}</span>
                <span className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <span className="block h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right text-slate-900 font-semibold">
                  {step.reached} <span className="text-slate-400 font-normal">({pct}%)</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function AgentTable({ agents }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Agents · is mahine</h2>
      {agents.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Koi approved sales agent nahi.</p>
      ) : (
        <div className="mt-3 overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2">Agent</th>
                <th scope="col" className="px-4 py-2 text-right">Chalu leads</th>
                <th scope="col" className="px-4 py-2 text-right">Visits</th>
                <th scope="col" className="px-4 py-2 text-right">Logins</th>
                <th scope="col" className="px-4 py-2 text-right">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map(a => (
                <tr key={a.agent_id}>
                  <th scope="row" className="px-4 py-2 font-medium text-slate-800 text-left">
                    <Link to={`/leads?assignee=${a.agent_id}`} className="hover:underline">{a.agent_name}</Link>
                  </th>
                  <td className="px-4 py-2 text-right">{a.open_leads}</td>
                  <td className="px-4 py-2 text-right">{a.visits_month}</td>
                  <td className="px-4 py-2 text-right">{a.logins_month}</td>
                  <td className={`px-4 py-2 text-right ${a.overdue > 0 ? 'text-red-600 font-semibold' : ''}`}>{a.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
