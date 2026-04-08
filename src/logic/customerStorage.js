const STORAGE_KEY = 'paisadost_customers'

export function loadAllCustomers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
  catch { return [] }
}

export function saveCustomer(inputs) {
  const all = loadAllCustomers()
  const name   = inputs.customerName?.trim()   || 'Unknown'
  const mobile = inputs.customerMobile?.trim() || ''

  // Update existing record if same name+mobile, else prepend new
  const existingIdx = mobile
    ? all.findIndex(c => c.customerMobile === mobile)
    : -1

  const record = {
    id:             existingIdx >= 0 ? all[existingIdx].id : Date.now().toString(),
    savedAt:        new Date().toISOString(),
    customerName:   name,
    customerMobile: mobile,
    inputs:         { ...inputs },
  }

  const updated = existingIdx >= 0
    ? [record, ...all.filter((_, i) => i !== existingIdx)]
    : [record, ...all]

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function deleteCustomer(id) {
  const all = loadAllCustomers().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
