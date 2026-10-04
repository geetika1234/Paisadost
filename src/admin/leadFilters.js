import { DEFAULT_FILTERS, SORTS } from '../lib/db/admin'

/**
 * Leads-page filters <-> URL query string, so a filtered view survives
 * refresh, back/forward, and can be linked to (the Today page does).
 * Only non-default values are written; unknown values fall back to defaults.
 */

const BOOL_KEYS = ['inactive', 'overdue']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function filtersFromParams(params) {
  const get = k => params.get(k)
  const f = { ...DEFAULT_FILTERS }
  if (get('q'))        f.search   = get('q').slice(0, 60)
  if (get('stage'))    f.stage    = get('stage')
  if (get('status'))   f.status   = get('status')
  if (get('assignee')) f.assignee = get('assignee')
  if (get('area'))     f.area     = get('area').slice(0, 60)
  if (DATE_RE.test(get('from') || '')) f.from = get('from')
  if (DATE_RE.test(get('to')   || '')) f.to   = get('to')
  for (const k of BOOL_KEYS) f[k] = get(k) === '1'
  if (SORTS[get('sort')]) f.sort = get('sort')
  return f
}

export function paramsFromFilters(f, extra = {}) {
  const p = new URLSearchParams()
  if (f.search)                          p.set('q', f.search)
  if (f.stage    !== DEFAULT_FILTERS.stage)    p.set('stage', f.stage)
  if (f.status   !== DEFAULT_FILTERS.status)   p.set('status', f.status)
  if (f.assignee !== DEFAULT_FILTERS.assignee) p.set('assignee', f.assignee)
  if (f.area)                            p.set('area', f.area)
  if (f.from)                            p.set('from', f.from)
  if (f.to)                              p.set('to', f.to)
  for (const k of BOOL_KEYS) if (f[k])   p.set(k, '1')
  if (f.sort     !== DEFAULT_FILTERS.sort)     p.set('sort', f.sort)
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v)
  return p
}

export function hasActiveFilters(f) {
  return paramsFromFilters({ ...f, sort: DEFAULT_FILTERS.sort }).toString() !== ''
}
