import { addEvent } from './events'
import { getCustomerStage } from './customers'

/**
 * changeLeadStatus(customerId, { status, reason, note }, salesman)
 * Records a status_changed event. The database decides whether it is allowed
 * (migration 009): agents may only close their own active/nurture lead as
 * lost or not_qualified; admins/managers may set any status. A reason is
 * always required. Returns the lead's status as the database settled it.
 */
/**
 * qualifyLead(customerId, note, actor)
 * A manager/admin marks a lead Qualified after reviewing the agent's
 * qualification answers. Records a lead_qualified event; the database moves
 * the stage to Qualified and rejects the event for sales users
 * (stage_role_denied, migration 015). Returns the stage as settled.
 */
export async function qualifyLead(customerId, note = '', actor = null) {
  await addEvent(customerId, 'lead_qualified', { note: note.trim() || null }, actor)
  return getCustomerStage(customerId)
}

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
