import { supabase } from '../supabase'

/**
 * quickDueDate(daysFromNow, hour)
 * ISO string for "N days from now at `hour`:00" — used by quick-pick chips.
 */
export function quickDueDate(daysFromNow, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/**
 * createReminder(customerId, dueAtIso, note, salesmanId, profileId)
 */
export async function createReminder(customerId, dueAtIso, note, salesmanId = null, profileId = null) {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      customer_id: customerId,
      due_at:      dueAtIso,
      note:        note?.trim() || null,
      salesman_id: salesmanId,
      created_by:  profileId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * getRemindersForCustomer(customerId)
 * All reminders for one lead, newest due_at first.
 */
export async function getRemindersForCustomer(customerId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('customer_id', customerId)
    .order('due_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * getOpenReminders(profileId)
 * Cross-lead task list: pending reminders joined to customer identity,
 * sorted soonest-first. profileId scopes to one salesman's assigned leads;
 * null returns every pending reminder team-wide (admin view).
 */
export async function getOpenReminders(profileId) {
  let query = supabase
    .from('reminders')
    .select('reminder_id, customer_id, due_at, note, status, salesman_id, customers!inner(customer_id, shop_name, owner_name, mobile, area, landmark, assigned_to)')
    .eq('status', 'pending')
    .order('due_at', { ascending: true })

  if (profileId) query = query.eq('customers.assigned_to', profileId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function completeReminder(reminderId) {
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('reminder_id', reminderId)
  if (error) throw error
}

/**
 * snoozeReminder(reminderId, newDueAtIso)
 * Reschedules a still-pending reminder to a later due date.
 */
export async function snoozeReminder(reminderId, newDueAtIso) {
  const { error } = await supabase
    .from('reminders')
    .update({ due_at: newDueAtIso })
    .eq('reminder_id', reminderId)
  if (error) throw error
}

/**
 * updateReminder(reminderId, { due_at?, note? })
 * Edit a pending reminder's due date and/or note.
 */
export async function updateReminder(reminderId, fields) {
  const patch = {}
  if (fields.due_at !== undefined) patch.due_at = fields.due_at
  if (fields.note   !== undefined) patch.note   = fields.note?.trim() || null
  const { error } = await supabase
    .from('reminders')
    .update(patch)
    .eq('reminder_id', reminderId)
  if (error) throw error
}

export async function deleteReminder(reminderId) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('reminder_id', reminderId)
  if (error) throw error
}
