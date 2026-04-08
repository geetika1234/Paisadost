const USER_KEY = 'pd_user'

export function getCurrentUser() {
  return localStorage.getItem(USER_KEY) || null
}

export function setCurrentUser(name) {
  localStorage.setItem(USER_KEY, name.trim())
}

function dataKey(user) { return `pd_data_${user}` }
function visitsKey(user) { return `pd_visits_${user}` }

export function getUserData(user) {
  try {
    const raw = localStorage.getItem(dataKey(user))
    let data = raw ? JSON.parse(raw) : null
    if (!data) {
      data = { todayVisits: 0, monthVisits: 0, fileLogin: 0, lastDate: new Date().toDateString(), lastMonth: getMonthKey() }
    }
    // auto-reset today if date changed
    const today = new Date().toDateString()
    if (data.lastDate !== today) {
      data.todayVisits = 0
      data.lastDate = today
    }
    // auto-reset month if month changed
    const thisMonth = getMonthKey()
    if (data.lastMonth !== thisMonth) {
      data.monthVisits = 0
      data.fileLogin   = 0
      data.lastMonth   = thisMonth
    }
    saveUserData(user, data)
    return data
  } catch {
    return { todayVisits: 0, monthVisits: 0, fileLogin: 0, lastDate: new Date().toDateString(), lastMonth: getMonthKey() }
  }
}

function saveUserData(user, data) {
  localStorage.setItem(dataKey(user), JSON.stringify(data))
}

function getMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function trackVisit(user) {
  const data = getUserData(user)
  data.todayVisits += 1
  data.monthVisits  += 1
  saveUserData(user, data)
}

export function markFileLogin(user) {
  const data = getUserData(user)
  data.fileLogin += 1
  saveUserData(user, data)
}

// ── Visited customers per salesman ───────────────────────────────────────────

export function saveVisitedCustomer(user, { shopName, ownerName, mobile, city, market }) {
  const all = getVisitedCustomers(user)
  const record = {
    id:          Date.now().toString(),
    shopName:    shopName  || 'Unknown',
    ownerName:   ownerName || '',
    mobile:      mobile    || '',
    city:        city      || '',
    market:      market    || '',
    visitedAt:   new Date().toISOString(),
    fileLogin:   false,
  }
  const updated = [record, ...all]
  localStorage.setItem(visitsKey(user), JSON.stringify(updated))
  // also track visit count
  trackVisit(user)
}

export function getVisitedCustomers(user) {
  try { return JSON.parse(localStorage.getItem(visitsKey(user))) || [] }
  catch { return [] }
}

export function markCustomerFileLogin(user, customerId) {
  const all = getVisitedCustomers(user)
  const updated = all.map(c =>
    c.id === customerId ? { ...c, fileLogin: true } : c
  )
  localStorage.setItem(visitsKey(user), JSON.stringify(updated))
  // also increment file login count
  markFileLogin(user)
}

export function resetDashboard(user) {
  localStorage.removeItem(dataKey(user))
  localStorage.removeItem(visitsKey(user))
}
