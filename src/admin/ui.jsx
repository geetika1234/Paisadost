import { useEffect } from 'react'
import { getStage, getStatus } from '../logic/stages'

/** Shared building blocks for admin pages. */

export function useDocumentTitle(title) {
  useEffect(() => { document.title = `${title} · Admin · AR Financiers` }, [title])
}

export function StageChip({ stage }) {
  const s = getStage(stage)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export function StatusChip({ status, reason }) {
  const s = getStatus(status)
  return (
    <span title={reason || undefined} className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function formatDate(iso, withTime = false) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  })
}

export function relativeDays(iso) {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Aaj'
  if (days === 1) return 'Kal'
  return `${days} din pehle`
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-red-700 underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Load ho raha hai...' }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
      <span aria-hidden="true" className="w-4 h-4 border-2 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
      {label}
    </div>
  )
}
