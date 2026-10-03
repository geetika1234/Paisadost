import { addEvent } from './events'
import { getCustomerStage } from './customers'

/**
 * changeLeadStatus(customerId, { status, reason, note }, salesman)
 * Records a status_changed event. The database decides whether it is allowed
 * (migration 009): agents may only close their own active/nurture lead as
 * lost or not_qualified; admins/managers may set any status. A reason is
 * always required. Returns the lead's status as the database settled it.
 */
export async function changeLeadStatus(customerId, { status, reason, note }, salesman = null) {
  const cleanReason = reason?.trim()
  if (!cleanReason) throw new Error('status_reason_required')
  await addEvent(customerId, 'status_changed', {
    status,
    reason: cleanReason,
    note:   note?.trim() || null,
  }, salesman)
  return getCustomerStage(customerId)
}
