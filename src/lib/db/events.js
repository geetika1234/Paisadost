import { supabase } from '../supabase'

/**
 * updateEventData(eventId, data)
 * Replaces the JSON data payload of an existing event (used for edits).
 * Throws if no event matched, so an edit can never be silently dropped.
 */
export async function updateEventData(eventId, data = {}) {
  const { data: rows, error } = await supabase
    .from('events')
    .update({ data })
    .eq('event_id', eventId)
    .select('event_id')
  if (error) throw error
  if (!rows?.length) throw new Error('event_not_found')
}

/**
 * addEvent(customerId, eventType, data, salesmanId?)
 * Records what happened. The database decides what it means for the lead's
 * stage (events_apply_stage trigger, migration 007): it only moves forward,
 * checks the caller's role and required photos, and rejects the insert with
 * stage_role_denied / stage_evidence_missing when a rule fails.
 *
 * Stage events: lead_created | visit_done | pain_identified | roi_shown | login_started
 * Other events: customer_response | note_added | loan_requirement | ...
 */
export async function addEvent(customerId, eventType, data = {}, salesmanId = null) {
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      customer_id: customerId,
      salesman_id: salesmanId,
      event_type:  eventType,
      data:        data,
    })
    .select()
    .single()
  if (error) throw error
  return event
}

/**
 * addNote(customerId, text, salesmanId)
 * Records a free-text note as a note_added event. note_added is not a
 * stage event, so adding a note never changes the lead's stage.
 */
export async function addNote(customerId, text, salesmanId = null) {
  const trimmed = text?.trim()
  if (!trimmed) return null
  return addEvent(customerId, 'note_added', { text: trimmed }, salesmanId)
}

/**
 * getLoanRequirement(customerId)
 * Latest loan_requirement event for a customer, or null.
 */
export async function getLoanRequirement(customerId) {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, data, created_at')
    .eq('customer_id', customerId)
    .eq('event_type', 'loan_requirement')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

/**
 * saveLoanRequirement(customerId, data, salesmanId)
 * Edits the existing loan_requirement event in place if there is one,
 * otherwise creates it — same pattern the engagement form uses.
 */
export async function saveLoanRequirement(customerId, data, salesmanId = null) {
  const existing = await getLoanRequirement(customerId)
  if (existing?.event_id) {
    await updateEventData(existing.event_id, data)
    return { ...existing, data }
  }
  return addEvent(customerId, 'loan_requirement', data, salesmanId)
}

/**
 * getNotes(customerId)
 * All note_added events for a customer, newest first.
 */
export async function getNotes(customerId) {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, data, salesman_id, created_at')
    .eq('customer_id', customerId)
    .eq('event_type', 'note_added')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
