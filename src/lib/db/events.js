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
