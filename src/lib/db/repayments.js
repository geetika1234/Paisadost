import { supabase } from '../supabase'

/**
 * addRepayment({ loan_id, emi_amount, due_date, paid?, delay_days? })
 * Inserts a repayment record for a loan EMI.
 */
export async function addRepayment({ loan_id, emi_amount, due_date, paid = false, delay_days = 0 }) {
  const { data, error } = await supabase
    .from('repayments')
    .insert({ loan_id, emi_amount, due_date, paid, delay_days })
    .select()
    .single()
  if (error) throw error
  return data
}
