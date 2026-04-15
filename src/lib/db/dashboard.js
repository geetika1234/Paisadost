import { supabase } from '../supabase'
import { saveCustomer } from './customers'
import { addEvent } from './events'

// ── Salesman session ──────────────────────────────────────────────────────────
// Salesman name is device-local session state — stored in localStorage.
// Only the *data* (visits, events) goes to Supabase.

const USER_KEY = 'pd_user'
export function getCurrentUser() { return localStorage.getItem(USER_KEY) || null }
export function setCurrentUser(name) { localStorage.setItem(USER_KEY, name.trim()) }

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function startOfThisMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString()
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

/**
 * getDashboardStats(salesman)
 * Returns { todayVisits, monthVisits, fileLogin } computed from the events table.
 */
export async function getDashboardStats(salesman) {
  const todayStart = startOfToday()
  const monthStart = startOfThisMonth()

  const [todayRes, monthRes, loginRes] = await Promise.all([
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('salesman_id', salesman)
      .eq('event_type', 'visit_done')
      .gte('created_at', todayStart),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('salesman_id', salesman)
      .eq('event_type', 'visit_done')
      .gte('created_at', monthStart),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('salesman_id', salesman)
      .eq('event_type', 'login_started')
      .gte('created_at', monthStart),
  ])

  if (todayRes.error) throw todayRes.error
  if (monthRes.error) throw monthRes.error
  if (loginRes.error) throw loginRes.error

  return {
    todayVisits: todayRes.count  || 0,
    monthVisits: monthRes.count  || 0,
    fileLogin:   loginRes.count  || 0,
  }
}

// ── Visited customers ─────────────────────────────────────────────────────────

/**
 * getVisitedCustomers(salesman)
 * Returns all visit_done events for this salesman, newest first.
 * Marks each customer as fileLogin=true if a login_started event exists for them today.
 */
export async function getVisitedCustomers(salesman) {
  const todayStart = startOfToday()

  const [visitsRes, loginsRes] = await Promise.all([
    supabase
      .from('events')
      .select(`
        event_id,
        data,
        created_at,
        customers (
          customer_id, name, mobile, shop_name, owner_name, area, landmark
        )
      `)
      .eq('salesman_id', salesman)
      .eq('event_type', 'visit_done')
      .order('created_at', { ascending: false }),

    supabase
      .from('events')
      .select('customer_id')
      .eq('salesman_id', salesman)
      .eq('event_type', 'login_started')
      .gte('created_at', todayStart),
  ])

  if (visitsRes.error) throw visitsRes.error

  const loggedIn = new Set((loginsRes.data || []).map(e => e.customer_id))

  return (visitsRes.data || []).map(e => {
    const d = e.data || {}
    return {
      id:         e.event_id,                                     // visit event_id — used for file login
      customerId: e.customers?.customer_id,
      shopName:   e.customers?.shop_name  || d.shopName  || 'Unknown',
      ownerName:  e.customers?.owner_name || d.ownerName || '',
      mobile:     e.customers?.mobile     || d.mobile    || '',
      city:       e.customers?.area       || d.city      || '',
      market:     e.customers?.landmark   || d.market    || '',
      visitedAt:  e.created_at,
      fileLogin:  loggedIn.has(e.customers?.customer_id),
      // Full event data — arrays are stored as JSON arrays in Supabase JSONB,
      // returned as native JS arrays. Safe to use directly.
      bizTypes:         Array.isArray(d.bizTypes)   ? d.bizTypes   : [],
      seasons:          Array.isArray(d.seasons)     ? d.seasons    : [],
      peakMonths:       Array.isArray(d.peakMonths)  ? d.peakMonths : [],
      problems:         Array.isArray(d.problems)    ? d.problems   : [],
      mindset:          Array.isArray(d.mindset)     ? d.mindset    : [],
      bizTypeOther:       d.bizTypeOther       || '',
      seasonOther:        d.seasonOther        || '',
      offSeasonSales:     d.offSeasonSales     || '',
      offSeasonSalesOther:d.offSeasonSalesOther|| '',
      investmentTiming:   d.investmentTiming   || '',
      prepTime:           d.prepTime           || '',
      prepTimeOther:      d.prepTimeOther      || '',
      decisionDelay:      d.decisionDelay      || '',
      mindsetOther:       d.mindsetOther       || '',
      photoUrls:          Array.isArray(d.photoUrls) ? d.photoUrls : [],
    }
  })
}

// ── Save visit ────────────────────────────────────────────────────────────────

/**
 * saveVisitedCustomer(salesman, formData)
 * Called from S_CustomerForm on submit.
 *   1. Upserts customer record (identity + shop details)
 *   2. Adds visit_done event (full form data in JSON)
 */
/**
 * saveVisitedCustomer(salesman, formData)
 *
 * formData is the full form object from S_CustomerForm (photos already stripped).
 *
 * Identity fields (shopName, ownerName, mobile, city, market) are written
 * to the customers table.
 *
 * The ENTIRE formData object is stored as-is inside events.data JSON.
 * No new columns are needed — any new field added to the form is
 * automatically captured without touching the schema.
 */
export async function saveVisitedCustomer(salesman, formData) {
  const { shopName, ownerName, mobile, city, market } = formData

  // 1. Upsert customer — only identity fields go into columns
  const customer = await saveCustomer({
    name:       ownerName || shopName,
    mobile:     mobile    || null,
    shop_name:  shopName,
    owner_name: ownerName,
    area:       city,
    landmark:   market,
    stage:      'visited',
  })

  // 2. Insert visit_done event — full formData stored in events.data JSON.
  //    Any future field added to the form is captured automatically here.
  await addEvent(customer.customer_id, 'visit_done', formData, salesman)

  return customer
}

// ── Mark file login ───────────────────────────────────────────────────────────

/**
 * markCustomerFileLogin(salesman, visitEventId)
 * Adds a login_started event for the customer linked to the given visit event.
 * This advances the customer's stage to 'login_started'.
 */
export async function markCustomerFileLogin(salesman, visitEventId) {
  const { data: visitEvent, error } = await supabase
    .from('events')
    .select('customer_id')
    .eq('event_id', visitEventId)
    .single()
  if (error) throw error

  await addEvent(
    visitEvent.customer_id,
    'login_started',
    { visit_event_id: visitEventId },
    salesman,
  )
}
