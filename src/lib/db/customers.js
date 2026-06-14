import { supabase } from '../supabase'

/**
 * saveCustomer(data)
 * Create or update a customer.
 * - If mobile exists in DB → update that record.
 * - If no mobile or new mobile → insert new record.
 * Only fields present in `data` are written (partial update safe).
 */
export async function saveCustomer({
  name, mobile, shop_name, owner_name,
  area, landmark, business_type, intent_level, stage,
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
  if (stage         !== undefined) payload.stage         = stage
  if (mobile        !== undefined) payload.mobile        = cleanMobile

  if (cleanMobile) {
    // Try to find existing customer by mobile
    const { data: existing, error: findErr } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('mobile', cleanMobile)
      .maybeSingle()
    if (findErr) throw findErr

    if (existing) {
      const { data, error } = await supabase
        .from('customers')
        .update(payload)
        .eq('customer_id', existing.customer_id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  }

  // No existing customer — insert new
  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
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
 * Returns the customer_id of any OTHER customer that already owns this mobile.
 * Returns null if mobile is free to use.
 */
export async function checkMobileDuplicate(mobile, excludeCustomerId) {
  if (!mobile?.trim()) return null
  let query = supabase
    .from('customers')
    .select('customer_id')
    .eq('mobile', mobile.trim())
  if (excludeCustomerId) query = query.neq('customer_id', excludeCustomerId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data?.customer_id || null
}

/**
 * deleteCustomer(customerId)
 * Deletes the customer and all related data (events, loans, repayments)
 * via ON DELETE CASCADE foreign keys in the schema.
 */
export async function deleteCustomer(customerId) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('customer_id', customerId)
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
  const ALLOWED = ['name', 'shop_name', 'owner_name', 'mobile', 'area', 'landmark', 'business_type', 'intent_level', 'stage']
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
  if (error) throw error
  return updated
}
