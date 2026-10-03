import { describe, it, expect, beforeEach, vi } from 'vitest'

const mock = vi.hoisted(() => ({ calls: [], result: null }))

vi.mock('../supabase', () => {
  function builder(table) {
    const b = { table, op: null, payload: null, filters: [] }
    b.insert = p => { b.op = 'insert'; b.payload = p; return b }
    b.update = p => { b.op = 'update'; b.payload = p; return b }
    b.eq     = (c, v) => { b.filters.push([c, v]); return b }
    b.select = () => {
      // update(...).select('event_id') resolves directly (no .single())
      if (b.op === 'update') {
        mock.calls.push(b)
        return Promise.resolve(mock.result ?? { data: [], error: null })
      }
      return b
    }
    b.single = async () => { mock.calls.push(b); return mock.result ?? { data: { event_id: 'e1' }, error: null } }
    return b
  }
  return { supabase: { from: table => builder(table) } }
})

import { addEvent, updateEventData } from './events'

beforeEach(() => { mock.calls = []; mock.result = null })

describe('addEvent', () => {
  it('only inserts the event; it never writes the lead\'s stage itself', async () => {
    await addEvent('c1', 'visit_done', { photoUrls: ['a', 'b', 'c'] }, 'Ravi')
    expect(mock.calls.map(c => `${c.table}.${c.op}`)).toEqual(['events.insert'])
  })

  it('surfaces a database stage refusal', async () => {
    mock.result = { data: null, error: { message: 'stage_evidence_missing: visited needs 3 photos, got 0' } }
    await expect(addEvent('c1', 'visit_done', {})).rejects.toMatchObject({ message: expect.stringContaining('stage_evidence_missing') })
  })
})

describe('updateEventData', () => {
  it('throws event_not_found when no event matched, instead of silently dropping the edit', async () => {
    mock.result = { data: [], error: null }
    await expect(updateEventData('not-an-event', { a: 1 })).rejects.toThrow('event_not_found')
  })

  it('succeeds when the event was updated', async () => {
    mock.result = { data: [{ event_id: 'e1' }], error: null }
    await expect(updateEventData('e1', { a: 1 })).resolves.toBeUndefined()
  })
})
