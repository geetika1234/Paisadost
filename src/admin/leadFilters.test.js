import { describe, it, expect } from 'vitest'
import { filtersFromParams, paramsFromFilters, hasActiveFilters } from './leadFilters'
import { DEFAULT_FILTERS } from '../lib/db/admin'

describe('lead filters in the URL', () => {
  it('writes nothing for the default view', () => {
    expect(paramsFromFilters(DEFAULT_FILTERS).toString()).toBe('')
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('round-trips every filter', () => {
    const f = {
      ...DEFAULT_FILTERS, search: 'Ram', stage: 'visited', status: 'closed', assignee: 'none',
      response: 'thinking', area: 'Jaipur', from: '2026-09-01', to: '2026-09-30', inactive: true, overdue: true, sort: 'activity_asc',
    }
    expect(filtersFromParams(paramsFromFilters(f))).toEqual(f)
    expect(hasActiveFilters(f)).toBe(true)
  })

  it('reads the links the Today page builds', () => {
    const f = filtersFromParams(new URLSearchParams('inactive=1&sort=activity_asc'))
    expect(f.inactive).toBe(true)
    expect(f.sort).toBe('activity_asc')
    expect(f.status).toBe('open')
  })

  it('ignores unknown response values', () => {
    expect(filtersFromParams(new URLSearchParams('response=maybe')).response).toBe('all')
    expect(filtersFromParams(new URLSearchParams('response=none')).response).toBe('none')
  })

  it('ignores malformed dates and unknown sorts', () => {
    const f = filtersFromParams(new URLSearchParams('from=yesterday&to=2026-13&sort=evil'))
    expect(f.from).toBe('')
    expect(f.to).toBe('')
    expect(f.sort).toBe(DEFAULT_FILTERS.sort)
  })

  it('a sort change alone does not count as filtering', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'activity_desc' })).toBe(false)
  })
})
