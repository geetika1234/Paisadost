import { describe, it, expect, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({ updateResult: null, calls: [] }))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const b = {}
      b.update = p => { mock.calls.push(['update', p]); return b }
      b.in     = (c, v) => { mock.calls.push(['in', c, v]); return b }
      b.select = () => Promise.resolve(mock.updateResult)
      return b
    },
  },
}))
vi.mock('./events', () => ({ addEvent: vi.fn() }))

import { sanitizeSearch, applyLeadFilters, toCsv, bulkAssign, DEFAULT_FILTERS, BULK_LIMIT } from './admin'

/** Records every builder call so we can assert on the query we would send. */
function recorder() {
  const calls = []
  const b = new Proxy({}, {
    get: (_, method) => (...args) => { calls.push([method, ...args]); return b },
  })
  return { b, calls }
}

beforeEach(() => { mock.calls = []; mock.updateResult = null })

describe('sanitizeSearch', () => {
  it('strips characters that would break or widen a PostgREST or-filter', () => {
    expect(sanitizeSearch('ram,shop_name.eq.x)')).toBe('ram shop_name.eq.x')
    expect(sanitizeSearch('100% * kirana')).toBe('100 kirana')
  })

  it('caps length and trims', () => {
    expect(sanitizeSearch('  a'.repeat(100)).length).toBeLessThanOrEqual(60)
    expect(sanitizeSearch(null)).toBe('')
  })
})

describe('applyLeadFilters', () => {
  it('defaults to open leads, newest first, with a stable tiebreaker', () => {
    const { b, calls } = recorder()
    applyLeadFilters(b, DEFAULT_FILTERS)
    expect(calls).toEqual([
      ['in', 'status', ['active', 'nurture']],
      ['order', 'created_at', { ascending: false, nullsFirst: false }],
      ['order', 'customer_id', { ascending: true }],
    ])
  })

  it('maps every filter to the right column', () => {
    const { b, calls } = recorder()
    const now = new Date('2026-10-03T12:00:00Z')
    applyLeadFilters(b, {
      ...DEFAULT_FILTERS,
      search: 'Ram', stage: 'roi_shown', status: 'lost', assignee: 'none',
      area: 'Jaipur', inactive: true, overdue: true, sort: 'followup_asc',
    }, now)
    const methods = calls.map(c => `${c[0]}:${c[1]}`)
    expect(calls[0]).toEqual(['or', 'shop_name.ilike.%Ram%,owner_name.ilike.%Ram%,mobile.ilike.%Ram%'])
    expect(methods).toContain('eq:stage')
    expect(methods).toContain('eq:status')
    expect(methods).toContain('is:assigned_to')
    expect(methods).toContain('ilike:area')
    expect(calls.find(c => c[0] === 'lt' && c[1] === 'last_activity_at')[2])
      .toBe(new Date('2026-08-04T12:00:00Z').toISOString())   // 60 days before now
    expect(methods).toContain('eq:followup_overdue')
    expect(calls.find(c => c[0] === 'order')).toEqual(['order', 'next_followup_at', { ascending: true, nullsFirst: false }])
  })

  it('filters closed leads and a specific agent', () => {
    const { b, calls } = recorder()
    applyLeadFilters(b, { ...DEFAULT_FILTERS, status: 'closed', assignee: 'agent-1' })
    expect(calls).toContainEqual(['in', 'status', ['not_qualified', 'lost', 'rejected', 'dormant']])
    expect(calls).toContainEqual(['eq', 'assigned_to', 'agent-1'])
  })

  it('falls back to the default sort for an unknown sort key', () => {
    const { b, calls } = recorder()
    applyLeadFilters(b, { ...DEFAULT_FILTERS, sort: 'drop_table' })
    expect(calls.find(c => c[0] === 'order')[1]).toBe('created_at')
  })
})

describe('toCsv', () => {
  const cols = [['a', 'A'], ['b', 'B']]

  it('starts with a BOM and uses CRLF rows', () => {
    const csv = toCsv([{ a: 1, b: 2 }], cols)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('A,B\r\n1,2')
  })

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([{ a: 'Ram, Shyam', b: 'say "hi"\nok' }], cols)
    expect(csv).toContain('"Ram, Shyam","say ""hi""\nok"')
  })

  it('neutralises spreadsheet formulas', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: '+91 98765' }], cols)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(`'+91 98765`)
  })

  it('writes empty cells for null and undefined', () => {
    expect(toCsv([{ a: null }], cols).slice(1)).toBe('A,B\r\n,')
  })
})

describe('bulkAssign', () => {
  it('reports leads the database did not update as failed', async () => {
    mock.updateResult = { data: [{ customer_id: 'c1' }], error: null }
    const res = await bulkAssign(['c1', 'c2'], 'agent-1')
    expect(res).toEqual({ succeeded: ['c1'], failed: ['c2'] })
    expect(mock.calls).toContainEqual(['update', { assigned_to: 'agent-1' }])
  })

  it(`refuses more than ${BULK_LIMIT} leads at once`, async () => {
    const ids = Array.from({ length: BULK_LIMIT + 1 }, (_, i) => `c${i}`)
    await expect(bulkAssign(ids, 'agent-1')).rejects.toThrow('bulk_limit')
    expect(mock.calls).toEqual([])
  })
})
