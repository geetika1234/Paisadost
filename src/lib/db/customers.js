import { supabase } from '../supabase'

const UNIQUE_VIOLATION = '23505'

/**
 * Thrown when a mobile number already belongs to a lead the caller may not
 * edit (another agent's, or one with no owner). Carries what the UI needs to
 * explain it without exposing the other lead.
 */
export class LeadOwnedError extends Error {
  constructor(ownerName) {
    super(ownerName
      ? `Yeh number ${ownerName} ki lead mein pehle se hai.`
      : 'Yeh number pehle se ek lead mein hai jo kisi ko assigned nahi hai. Admin se assign karwayein.')
    this.name = 'LeadOwnedError'
    this.ownerName = ownerName || null
  }
}

const TEAM_MOBILE_MESSAGE = 'Yeh number hamari team ke ek member ka hai. Customer ka apna number daalein.'
const TEAM_MOBILE_DB_ERROR = 'mobile_is_team_member'

/**
 * Thrown when the mobile belongs to an approved team member (migration 013).
 * Extends LeadOwnedError so every screen that shows mobile conflicts on the
 * mobile field handles it the same way.
 */
export class TeamMobileError extends LeadOwnedError {
  constructor() {
    super(null)
    this.name = 'TeamMobileError'
    this.message = TEAM_MOBILE_MESSAGE
  }
}

/**
 * findCustomerByMobile(mobile)
 * Looks up a mobile across ALL leads via the find_customer_by_mobile RPC, so it
 * keeps working once RLS hides other agents' leads.
 * Returns null, or { customerId, isMine, canEdit, ownerName, isTeam } where
 * customerId is null unless the caller may open that lead, and isTeam means
 * the number belongs to a team member (never a valid lead number).
 */
export async function findCustomerByMobile(mobile) {
  const clean = mobile?.trim()
  if (!clean) return null
  const { data, error } = await supabase.rpc('find_customer_by_mobile', { p_mobile: clean })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    customerId: row.customer_id || null,
    isMine:     !!row.is_mine,
    canEdit:    !!row.can_edit,
    ownerName:  row.owner_name || null,
    isTeam:     !!row.is_team,
  }
}

/**
 * saveCustomer(data)
 * Create or update a customer.
 * - Mobile belongs to a lead the caller may edit → update that record.
 * - Mobile belongs to someone else's lead → throws LeadOwnedError (no write).
 * - No mobile or new mobile → insert; the DB sets assigned_to = caller.
 * Only fields present in `data` are written (partial update safe).
 */
export async function saveCustomer({
  name, mobile, shop_name, owner_name,
  area, landmark, business_type, intent_level,
}) {
  const cleanMobile = mobile?.trim() || null

  // Build payload — only include defined fields
  const payload = {}
  if (name          !== undefined) payload.name          = name?.trim()          || null
  if (shop_name     !== undefined) payload.shop_name     = shop_name?.trim()     || null
  if (owner_name    !== undefined) payload.owner_name    = owner_name?.trim()    || null
  if (area          !== undefined) payload.area          = area?.trim()          || null
  if (landmark      !== undefined) payload.landmark      = landmark?.trim()      || null
  if (business_type !== undefined) payload.business_type = business_type?.trim() || null
  if (intent_level  !== undefined) payload.intent_level  = intent_level
  if (mobile        !== undefined) payload.mobile        = cleanMobile

  if (cleanMobile) {
    const existing = await findCustomerByMobile(cleanMobile)
    if (existing) return updateExisting(existing, payload)
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select()
    .single()

  if (error?.code === UNIQUE_VIOLATION && cleanMobile) {
    // Another agent saved the same number between our lookup and insert.
    const existing = await findCustomerByMobile(cleanMobile)
    if (existing) return updateExisting(existing, payload)
  }
  if (error) throwCustomerWriteError(error)
  return data
}

async function updateExisting(existing, payload) {
  if (existing.isTeam) throw new TeamMobileError()
  if (!existing.canEdit || !existing.customerId) throw new LeadOwnedError(existing.ownerName)
  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('customer_id', existing.customerId)
    .select()
    .single()
  if (error) throwCustomerWriteError(error)
  return data
}

/** The DB refuses team-member mobiles (013); surface that as TeamMobileError. */
function throwCustomerWriteError(error) {
  if (error?.message?.includes(TEAM_MOBILE_DB_ERROR)) throw new TeamMobileError()
  throw error
}

/**
 * getCustomerFull(customerId)
 * Returns the full customer journey:
 *   { customer, events, loans }
 */
export async function getCustomerFull(customerId) {
  const [customerRes, eventsRes, loansRes] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('customer_id', customerId)
      .single(),
    supabase
      .from('events')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('loans')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
  ])

  if (customerRes.error) throw customerRes.error

  return {
    customer: customerRes.data,
    events:   eventsRes.data  || [],
    loans:    loansRes.data   || [],
  }
}

/**
 * checkMobileDuplicate(mobile, excludeCustomerId)
 * Returns the findCustomerByMobile() result when ANOTHER lead already has this
 * mobile, or null if the number is free (or belongs to excludeCustomerId).
 */
export async function checkMobileDuplicate(mobile, excludeCustomerId) {
  const existing = await findCustomerByMobile(mobile)
  if (!existing) return null
  if (excludeCustomerId && existing.customerId === excludeCustomerId) return null
  return existing
}

/**
 * duplicateMobileMessage(dup)
 * One user-facing sentence for a checkMobileDuplicate() hit.
 */
export function duplicateMobileMessage(dup) {
  if (dup.isTeam)  return TEAM_MOBILE_MESSAGE
  if (dup.canEdit) return 'Yeh number aapki ek lead mein pehle se hai.'
  return new LeadOwnedError(dup.ownerName).message
}

/**
 * deleteCustomer(customerId)
 * Deletes the customer and all related data via the delete_customer RPC.
 * The DB allows admins any lead, and owners only within 24h of creating it,
 * and writes an audit snapshot first (migration 006).
 */
export async function deleteCustomer(customerId) {
  const { error } = await supabase.rpc('delete_customer', { p_customer_id: customerId })
  if (error) throw error
}

/**
 * assignCustomer(customerId, profileId)
 * Sets assigned_to on a customer. Pass null to unassign.
 */
export async function assignCustomer(customerId, profileId) {
  const { error } = await supabase
    .from('customers')
    .update({ assigned_to: profileId })
    .eq('customer_id', customerId)
  if (error) throw error
}

/**
 * getAllCustomersAdmin()
 * Returns all customers with their assignment info (for admin panel).
 */
export async function getAllCustomersAdmin() {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, shop_name, owner_name, mobile, stage, area, landmark, created_at, assigned_to')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * updateCustomer(customerId, data)
 * Partial update — never overwrites existing data with empty/null values.
 * Safe to call with any subset of fields.
 */
export async function updateCustomer(customerId, data) {
  const ALLOWED = ['name', 'shop_name', 'owner_name', 'mobile', 'area', 'landmark', 'business_type', 'intent_level']
  const payload = {}
  for (const key of ALLOWED) {
    const v = data[key]
    if (v !== undefined && v !== null && v !== '') payload[key] = v
  }
  if (Object.keys(payload).length === 0) return null
  const { data: updated, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('customer_id', customerId)
    .select()
    .single()
  if (error) throwCustomerWriteError(error)
  return updated
}

/**
 * getCustomerStage(customerId)
 * The stage the database settled on after an event (see addEvent). Screens
 * call this instead of guessing, because the trigger may keep a higher stage.
 */
export async function getCustomerStage(customerId) {
  const { data, error } = await supabase
    .from('customers')
    .select('stage, stage_rank, status')
    .eq('customer_id', customerId)
    .single()
  if (error) throw error
  return data
}
