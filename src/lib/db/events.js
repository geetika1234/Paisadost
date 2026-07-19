import { supabase } from '../supabase'

// Maps event_type → customer stage
const STAGE_MAP = {
  visit_done:      'visited',
  pain_identified: 'pain_identified',
  roi_shown:       'roi_shown',
  login_started:   'login_started',
  kyc_completed:   'login_started',
  approved:        'approved',
  disbursed:       'disbursed',
}

/**
 * addEvent(customerId, eventType, data, salesmanId?)
 * Inserts an event and advances the customer's stage accordingly.
 *
 * Event types: visit_done | pain_identified | roi_shown | login_started |
 *              kyc_completed | approved | disbursed | emi_paid | default
 */
/**
 * updateEventData(eventId, data)
 * Replaces the JSON data payload of an existing event (used for edits).
 */
export async function updateEventData(eventId, data = {}) {
  const { error } = await supabase
    .from('events')
    .update({ data })
    .eq('event_id', eventId)
  if (error) throw error
}

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

  // Advance customer stage (fire-and-forget — don't block on failure)
  const newStage = STAGE_MAP[eventType]
  if (newStage) {
    supabase
      .from('customers')
      .update({ stage: newStage })
      .eq('customer_id', customerId)
      .then(({ error: e }) => { if (e) console.error('[addEvent] stage update failed:', e) })
  }

  return event
}

/**
 * addNote(customerId, text, salesmanId)
 * Records a free-text note as a note_added event. Not in STAGE_MAP —
 * adding a note never advances the customer's stage.
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
