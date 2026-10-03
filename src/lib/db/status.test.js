import { describe, it, expect, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({ events: [] }))

vi.mock('./events', () => ({
  addEvent: async (customerId, type, data, salesman) => { mock.events.push({ customerId, type, data, salesman }); return { event_id: 'e1' } },
}))
vi.mock('./customers', () => ({
  getCustomerStage: async () => ({ stage: 'roi_shown', status: 'lost', status_reason: 'Dukaan band ho gayi' }),
}))

import { changeLeadStatus } from './status'

beforeEach(() => { mock.events = [] })

describe('changeLeadStatus', () => {
  it('records a status_changed event with a trimmed reason and returns the settled status', async () => {
    const settled = await changeLeadStatus('c1', { status: 'lost', reason: '  Dukaan band ho gayi ', note: '  ' }, 'Ravi')

    expect(mock.events).toEqual([{
      customerId: 'c1', type: 'status_changed', salesman: 'Ravi',
      data: { status: 'lost', reason: 'Dukaan band ho gayi', note: null },
    }])
    expect(settled.status).toBe('lost')
  })

  it('refuses to send a change without a reason', async () => {
    await expect(changeLeadStatus('c1', { status: 'lost', reason: '   ' })).rejects.toThrow('status_reason_required')
    expect(mock.events).toEqual([])
  })
})
