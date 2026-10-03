import { describe, it, expect, beforeEach, vi } from 'vitest'

// Minimal stand-in for the supabase-js query builder: records every write and
// replays queued results, so tests assert on what we send to the database.
const mock = vi.hoisted(() => ({
  rpcCalls: [],
  rpcResults: [],
  writes: [],
  results: { insert: [], update: [] },
}))

vi.mock('../supabase', () => {
  function builder() {
    const b = { op: null, payload: null, filters: [] }
    b.insert = p => { b.op = 'insert'; b.payload = p; return b }
    b.update = p => { b.op = 'update'; b.payload = p; return b }
    b.eq     = (col, val) => { b.filters.push([col, val]); return b }
    b.select = () => b
    b.single = async () => {
      mock.writes.push({ op: b.op, payload: b.payload, filters: b.filters })
      return mock.results[b.op].shift() ?? { data: null, error: null }
    }
    return b
  }
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name, args) => {
        mock.rpcCalls.push({ name, args })
        return mock.rpcResults.shift() ?? { data: [], error: null }
      },
    },
  }
})

import {
  saveCustomer, checkMobileDuplicate, deleteCustomer, findCustomerByMobile,
  duplicateMobileMessage, LeadOwnedError,
} from './customers'

const lookup = row => ({ data: row ? [row] : [], error: null })
const colleagueLead = { customer_id: null, is_mine: false, can_edit: false, owner_name: 'Ravi' }
const myLead        = { customer_id: 'c-mine', is_mine: true, can_edit: true, owner_name: 'Me' }

beforeEach(() => {
  mock.rpcCalls = []
  mock.rpcResults = []
  mock.writes = []
  mock.results = { insert: [], update: [] }
})

describe('saveCustomer', () => {
  it('refuses to touch a colleague\'s lead and names the owner', async () => {
    mock.rpcResults.push(lookup(colleagueLead))

    const err = await saveCustomer({ shop_name: 'Ram Kirana', mobile: '9876543210' }).catch(e => e)

    expect(err).toBeInstanceOf(LeadOwnedError)
    expect(err.ownerName).toBe('Ravi')
    expect(err.message).toContain('Ravi')
    expect(mock.writes).toEqual([])
  })

  it('updates the caller\'s own lead by id', async () => {
    mock.rpcResults.push(lookup(myLead))
    mock.results.update.push({ data: { customer_id: 'c-mine' }, error: null })

    await saveCustomer({ shop_name: 'Ram Kirana', mobile: '9876543210' })

    expect(mock.writes).toHaveLength(1)
    expect(mock.writes[0].op).toBe('update')
    expect(mock.writes[0].filters).toEqual([['customer_id', 'c-mine']])
  })

  it('inserts a new lead without sending an owner (the DB default sets it)', async () => {
    mock.rpcResults.push(lookup(null))
    mock.results.insert.push({ data: { customer_id: 'c-new', assigned_to: 'u1' }, error: null })

    const saved = await saveCustomer({ shop_name: 'Ram Kirana', mobile: ' 9876543210 ' })

    expect(saved.customer_id).toBe('c-new')
    expect(mock.rpcCalls[0]).toEqual({ name: 'find_customer_by_mobile', args: { p_mobile: '9876543210' } })
    expect(mock.writes[0].op).toBe('insert')
    expect(mock.writes[0].payload).not.toHaveProperty('assigned_to')
    expect(mock.writes[0].payload.mobile).toBe('9876543210')
  })

  it('turns a same-second duplicate insert into LeadOwnedError instead of a raw 23505', async () => {
    mock.rpcResults.push(lookup(null), lookup(colleagueLead))
    mock.results.insert.push({ data: null, error: { code: '23505', message: 'duplicate key value' } })

    const err = await saveCustomer({ shop_name: 'Ram Kirana', mobile: '9876543210' }).catch(e => e)

    expect(err).toBeInstanceOf(LeadOwnedError)
    expect(mock.rpcCalls).toHaveLength(2)
  })

  it('never sends stage, even if a caller passes one (the DB owns stage)', async () => {
    mock.results.insert.push({ data: { customer_id: 'c-new' }, error: null })

    await saveCustomer({ shop_name: 'Ram Kirana', stage: 'login_started' })

    expect(mock.writes[0].payload).not.toHaveProperty('stage')
  })

  it('skips the lookup and inserts when there is no mobile', async () => {
    mock.results.insert.push({ data: { customer_id: 'c-new' }, error: null })

    await saveCustomer({ shop_name: 'Ram Kirana' })

    expect(mock.rpcCalls).toEqual([])
    expect(mock.writes[0].op).toBe('insert')
  })
})

describe('checkMobileDuplicate', () => {
  it('is not a duplicate when the number belongs to the lead being edited', async () => {
    mock.rpcResults.push(lookup(myLead))
    expect(await checkMobileDuplicate('9876543210', 'c-mine')).toBeNull()
  })

  it('reports a colleague\'s lead without exposing its id', async () => {
    mock.rpcResults.push(lookup(colleagueLead))
    const dup = await checkMobileDuplicate('9876543210', 'c-mine')
    expect(dup).toMatchObject({ customerId: null, canEdit: false, ownerName: 'Ravi' })
    expect(duplicateMobileMessage(dup)).toContain('Ravi')
  })

  it('explains an unassigned lead instead of naming nobody', async () => {
    mock.rpcResults.push(lookup({ ...colleagueLead, owner_name: null }))
    const dup = await checkMobileDuplicate('9876543210', null)
    expect(duplicateMobileMessage(dup)).toContain('Admin se assign')
  })

  it('surfaces RPC failures (e.g. unapproved caller) instead of treating the number as free', async () => {
    mock.rpcResults.push({ data: null, error: { message: 'not_approved' } })
    await expect(findCustomerByMobile('9876543210')).rejects.toMatchObject({ message: 'not_approved' })
  })
})

describe('deleteCustomer', () => {
  it('goes through the guarded RPC, never a direct table delete', async () => {
    await deleteCustomer('c-1')
    expect(mock.rpcCalls).toEqual([{ name: 'delete_customer', args: { p_customer_id: 'c-1' } }])
    expect(mock.writes).toEqual([])
  })

  it('throws the database refusal', async () => {
    mock.rpcResults.push({ data: null, error: { message: 'delete_not_allowed' } })
    await expect(deleteCustomer('c-1')).rejects.toMatchObject({ message: 'delete_not_allowed' })
  })
})
