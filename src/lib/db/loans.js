import { supabase } from '../supabase'
import { saveCustomer, updateCustomer } from './customers'
import { addEvent } from './events'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * createLoan({ customer_id, loan_amount, tenure, interest_rate, status? })
 * Inserts a new loan record.
 */
export async function createLoan({ customer_id, loan_amount, tenure, interest_rate, status = 'pending' }) {
  const { data, error } = await supabase
    .from('loans')
    .insert({ customer_id, loan_amount, tenure, interest_rate, status })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * saveLoan(inputs)
 * Full save triggered from the ROI tool ("Save Karen" button).
 *
 * Steps:
 *   1. Upsert customer (by mobile)
 *   2. Add roi_shown event → stores the COMPLETE inputs JSON so "Load Karen" can restore everything
 *   3. Upsert loan with the numeric loan fields
 */
export async function saveLoan(inputs, existingCustomerId = null) {
  let customerId = existingCustomerId

  if (customerId) {
    // 1a. Known customer — just update stage, no mobile lookup needed
    await updateCustomer(customerId, { stage: 'roi_shown' })
  } else {
    // 1b. No known ID — upsert by mobile (legacy / standalone flow)
    const customer = await saveCustomer({
      name:          inputs.customerName,
      mobile:        inputs.customerMobile,
      business_type: inputs.businessType,
      stage:         'roi_shown',
    })
    customerId = customer.customer_id
  }

  // 2. Log roi_shown event — data carries the FULL inputs so "Load Karen" works
  await addEvent(customerId, 'roi_shown', inputs)

  // 3. Upsert loan record
  const { data: existing } = await supabase
    .from('loans')
    .select('loan_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('loans')
      .update({
        loan_amount:   inputs.loanAmount,
        tenure:        inputs.tenureMonths,
        interest_rate: inputs.interestRate,
      })
      .eq('loan_id', existing.loan_id)
  } else {
    await createLoan({
      customer_id:   customerId,
      loan_amount:   inputs.loanAmount,
      tenure:        inputs.tenureMonths,
      interest_rate: inputs.interestRate,
    })
  }

  return { customer_id: customerId }
}

/**
 * getAllLoans()
 * Returns all customers who have a roi_shown event, newest first.
 * Each record includes the full inputs JSON from the latest roi_shown event
 * so the UI can restore every form field via "Load Karen".
 */
export async function getAllLoans() {
  const { data, error } = await supabase
    .from('events')
    .select(`
      event_id,
      data,
      created_at,
      customers (
        customer_id, name, mobile, shop_name, business_type
      )
    `)
    .eq('event_type', 'roi_shown')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Deduplicate — keep only the latest roi_shown event per customer
  const seen = new Set()
  return (data || [])
    .filter(e => {
      const cid = e.customers?.customer_id
      if (!cid || seen.has(cid)) return false
      seen.add(cid)
      return true
    })
    .map(e => ({
      id:             e.customers.customer_id,   // customer_id used for delete
      savedAt:        e.created_at,
      customerName:   e.customers.name        || 'Unknown',
      customerMobile: e.customers.mobile      || '',
      inputs:         e.data,                    // full inputs JSON → restores all form fields
    }))
}

/**
 * deleteLoan(customerId)
 * Deletes the customer + everything linked to them:
 *   events, loans, repayments — all cascade via ON DELETE CASCADE.
 */
export async function deleteLoan(customerId) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('customer_id', customerId)
  if (error) throw error
}
