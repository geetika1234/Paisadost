import { supabase } from '../supabase'
import { addEvent } from './events'

/**
 * Data access for the desktop admin console. Every call runs with the
 * signed-in user's rights; RLS (migration 010) and the event triggers
 * (007/009) are what actually enforce who may see or change what.
 */

export const PAGE_SIZE      = 50
export const BULK_LIMIT     = 100     // keeps one request's id list well under URL limits
export const EXPORT_LIMIT   = 10000
const FETCH_CHUNK           = 1000    // PostgREST max rows per request
export const DORMANT_DAYS   = 60

export const SORTS = {
  created_desc:  { column: 'created_at',       ascending: false, label: 'Nayi pehle' },
  created_asc:   { column: 'created_at',       ascending: true,  label: 'Purani pehle' },
  activity_desc: { column: 'last_activity_at', ascending: false, label: 'Haal ki activity' },
  activity_asc:  { column: 'last_activity_at', ascending: true,  label: 'Sabse purani activity' },
  followup_asc:  { column: 'next_followup_at', ascending: true,  label: 'Agla follow-up' },
}

export const DEFAULT_FILTERS = {
  search:   '',
  stage:    'all',
  status:   'open',       // 'open' | 'closed' | 'all' | <status key>
  assignee: 'all',        // 'all' | 'none' | <profile id>
  area:     '',
  from:     '',           // yyyy-mm-dd, created on/after
  to:       '',           // yyyy-mm-dd, created on/before
  inactive: false,        // no activity for DORMANT_DAYS
  overdue:  false,        // has an overdue follow-up
  sort:     'created_desc',
}

const OPEN_STATUSES   = ['active', 'nurture']
const CLOSED_STATUSES = ['not_qualified', 'lost', 'rejected', 'dormant']

/**
 * Characters that would change the meaning of a PostgREST filter string
 * (`or=(a.ilike.x,b.ilike.y)`) or act as LIKE wildcards. Removed, not escaped:
 * nobody searches a shop name for them.
 */
export function sanitizeSearch(text) {
  return String(text || '').replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** Applies the Leads-page filters to a PostgREST query builder. */
export function applyLeadFilters(query, f = DEFAULT_FILTERS, now = new Date()) {
  let q = query
  const search = sanitizeSearch(f.search)
  if (search) {
    q = q.or(`shop_name.ilike.%${search}%,owner_name.ilike.%${search}%,mobile.ilike.%${search}%`)
  }
  if (f.stage && f.stage !== 'all') q = q.eq('stage', f.stage)

  if (f.status === 'open')        q = q.in('status', OPEN_STATUSES)
  else if (f.status === 'closed') q = q.in('status', CLOSED_STATUSES)
  else if (f.status && f.status !== 'all') q = q.eq('status', f.status)

  if (f.assignee === 'none')                    q = q.is('assigned_to', null)
  else if (f.assignee && f.assignee !== 'all')  q = q.eq('assigned_to', f.assignee)

  const area = sanitizeSearch(f.area)
  if (area) q = q.ilike('area', `%${area}%`)

  if (f.from) q = q.gte('created_at', new Date(`${f.from}T00:00:00`).toISOString())
  if (f.to)   q = q.lte('created_at', new Date(`${f.to}T23:59:59.999`).toISOString())

  if (f.inactive) {
    const cutoff = new Date(now.getTime() - DORMANT_DAYS * 24 * 60 * 60 * 1000)
    q = q.lt('last_activity_at', cutoff.toISOString())
  }
  if (f.overdue) q = q.eq('followup_overdue', true)

  const sort = SORTS[f.sort] || SORTS.created_desc
  q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
  // Stable paging when many rows share the sort value.
  q = q.order('customer_id', { ascending: true })
  return q
}

export async function listLeadsPage(filters, page = 0) {
  const from = page * PAGE_SIZE
  const query = applyLeadFilters(supabase.from('lead_summary').select('*', { count: 'exact' }), filters)
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data || [], total: count ?? null }
}

/** All matching leads (capped), fetched in chunks to get past the 1000-row cap. */
export async function fetchAllLeads(filters, onProgress) {
  const rows = []
  for (let from = 0; from < EXPORT_LIMIT; from += FETCH_CHUNK) {
    const query = applyLeadFilters(supabase.from('lead_summary').select('*'), filters)
    const { data, error } = await query.range(from, from + FETCH_CHUNK - 1)
    if (error) throw error
    rows.push(...(data || []))
    onProgress?.(rows.length)
    if (!data || data.length < FETCH_CHUNK) break
  }
  return rows
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export const EXPORT_COLUMNS = [
  ['shop_name',        'Shop'],
  ['owner_name',       'Owner'],
  ['mobile',           'Mobile'],
  ['area',             'Area'],
  ['landmark',         'Market'],
  ['stage',            'Stage'],
  ['status',           'Status'],
  ['status_reason',    'Status reason'],
  ['assignee_name',    'Agent'],
  ['created_at',       'Created'],
  ['last_activity_at', 'Last activity'],
  ['next_followup_at', 'Next follow-up'],
]

function csvCell(value) {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Spreadsheet formula injection: a cell starting with = + - @ is executed by Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns = EXPORT_COLUMNS) {
  const header = columns.map(([, label]) => csvCell(label)).join(',')
  const body   = rows.map(r => columns.map(([key]) => csvCell(r[key])).join(','))
  // BOM so Excel opens Hindi/Hinglish text as UTF-8.
  return '﻿' + [header, ...body].join('\r\n')
}

export async function logAdminAction(action, details = {}) {
  const { error } = await supabase.rpc('log_admin_action', { p_action: action, p_details: details })
  if (error) throw error
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

/**
 * Assign up to BULK_LIMIT leads to one agent. RLS may silently skip rows the
 * caller cannot change, so success is judged by the ids the database returns.
 */
export async function bulkAssign(customerIds, profileId) {
  if (customerIds.length > BULK_LIMIT) throw new Error(`bulk_limit: ${BULK_LIMIT}`)
  const { data, error } = await supabase
    .from('customers')
    .update({ assigned_to: profileId })
    .in('customer_id', customerIds)
    .select('customer_id')
  if (error) throw error
  const done = new Set((data || []).map(r => r.customer_id))
  return {
    succeeded: customerIds.filter(id => done.has(id)),
    failed:    customerIds.filter(id => !done.has(id)),
  }
}

/**
 * Set one status on many leads, one status_changed event each. Leads are
 * processed one at a time so a refusal on one (e.g. Rejected before Login
 * Done) does not undo the others; failures are reported per lead.
 */
export async function bulkSetStatus(customerIds, { status, reason }, salesman = null) {
  if (customerIds.length > BULK_LIMIT) throw new Error(`bulk_limit: ${BULK_LIMIT}`)
  const succeeded = []
  const failed = []
  for (const id of customerIds) {
    try {
      await addEvent(id, 'status_changed', { status, reason: reason.trim(), note: null }, salesman)
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, message: err.message })
    }
  }
  return { succeeded, failed }
}

// ── Today + lead detail ──────────────────────────────────────────────────────

export async function getTodaySummary() {
  const { data, error } = await supabase.rpc('admin_today_summary')
  if (error) throw error
  return data
}

export async function listTeam() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, fullname, role, is_approved')
    .eq('is_approved', true)
    .order('fullname', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getLeadDetail(customerId) {
  const [lead, events, history, reminders] = await Promise.all([
    supabase.from('lead_summary').select('*').eq('customer_id', customerId).maybeSingle(),
    supabase.from('events').select('event_id, event_type, data, salesman_id, created_by, created_at')
      .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(200),
    supabase.from('stage_history').select('*')
      .eq('customer_id', customerId).order('changed_at', { ascending: false }).limit(200),
    supabase.from('reminders').select('reminder_id, due_at, note, status, completion_note, completed_at')
      .eq('customer_id', customerId).order('due_at', { ascending: false }).limit(50),
  ])
  for (const res of [lead, events, history, reminders]) if (res.error) throw res.error
  if (!lead.data) throw new Error('customer_not_found')
  return {
    lead:      lead.data,
    events:    events.data    || [],
    history:   history.data   || [],
    reminders: reminders.data || [],
  }
}
