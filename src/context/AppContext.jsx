import { createContext, useContext, useState } from 'react'
import { DEFAULT_INPUTS, BLANK_INPUTS } from '../logic/calculations'
import { saveLoan } from '../lib/db/loans'

const AppContext = createContext(null)

// Persist active customer across page refreshes
function loadActiveCustomer() {
  try {
    const c = JSON.parse(localStorage.getItem('pd_active_customer') || 'null')
    // Must have a valid id — old sessions without id are discarded
    if (!c || !c.id) return null
    return c
  } catch { return null }
}

export function AppProvider({ children }) {
  const [inputs, setInputs] = useState(() => {
    const customer = loadActiveCustomer()
    return { ...BLANK_INPUTS, customerName: customer?.shopName || '', customerMobile: customer?.mobile || '', businessType: customer?.businessType || '' }
  })
  const [screen,     setScreen]     = useState(0)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  // ── Active Customer ───────────────────────────────────────────────────────
  // Single source of truth for "which customer are we working on right now"
  const [activeCustomer, setActiveCustomerState] = useState(loadActiveCustomer)

  // ── Main screen ───────────────────────────────────────────────────────────
  // 'home' | 'workspace' | 'roi'
  const [mainScreen, setMainScreen] = useState(() =>
    loadActiveCustomer() ? 'workspace' : 'home'
  )

  // Backward-compat computed value (used by S_PainDiscovery, ROI tool, etc.)
  const customerId = activeCustomer?.id ?? null

  function activateCustomer(c) {
    // Guard — never store a customer without a valid id
    if (!c || !c.id) return
    // Strip savedROIInputs before persisting — it's large and only needed for inputs state
    const { savedROIInputs, ...customerToStore } = c
    setActiveCustomerState(customerToStore)
    localStorage.setItem('pd_active_customer', JSON.stringify(customerToStore))
    // If old lead with saved ROI data → restore it; otherwise blank defaults
    if (savedROIInputs) {
      setInputs({
        ...BLANK_INPUTS,
        ...savedROIInputs,
        customerName:   c.shopName     || savedROIInputs.customerName   || '',
        customerMobile: c.mobile       || savedROIInputs.customerMobile || '',
        businessType:   c.businessType || savedROIInputs.businessType   || '',
      })
    } else {
      setInputs({
        ...BLANK_INPUTS,
        customerName:   c.shopName     || '',
        customerMobile: c.mobile       || '',
        businessType:   c.businessType || '',
      })
    }
    setScreen(0)
    setMainScreen('workspace')
  }

  function updateActiveCustomer(patch) {
    setActiveCustomerState(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('pd_active_customer', JSON.stringify(next))
      return next
    })
  }

  function clearActiveCustomer() {
    setActiveCustomerState(null)
    localStorage.removeItem('pd_active_customer')
    setInputs(BLANK_INPUTS)
    setMainScreen('home')
  }

  const resetCustomer = clearActiveCustomer

  // ── Modal flags ───────────────────────────────────────────────────────────
  const [assistantOpen,           setAssistantOpen]           = useState(false)
  const [painDiscoveryOpen,       setPainDiscoveryOpen]       = useState(false)
  const [customerFormOpen,        setCustomerFormOpen]        = useState(false)
  const [customerFormInitialData, setCustomerFormInitialData] = useState(null)
  const [savedCustomersOpen,      setSavedCustomersOpen]      = useState(false)
  const [dashboardOpen,           setDashboardOpen]           = useState(false)
  const [quickCreateOpen,         setQuickCreateOpen]         = useState(false)

  // ── Inputs helpers ────────────────────────────────────────────────────────
  function update(key, value) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function toggleProblem(tag) {
    setInputs(prev => {
      const has = prev.problems.includes(tag)
      return {
        ...prev,
        problems: has ? prev.problems.filter(p => p !== tag) : [...prev.problems, tag],
      }
    })
  }

  function toggleSubProblem(parentTag, subTag) {
    setInputs(prev => {
      const hasSub    = prev.subProblems.includes(subTag)
      const hasParent = prev.problems.includes(parentTag)
      return {
        ...prev,
        problems:    !hasParent && !hasSub ? [...prev.problems, parentTag] : prev.problems,
        subProblems: hasSub
          ? prev.subProblems.filter(s => s !== subTag)
          : [...prev.subProblems, subTag],
      }
    })
  }

  const next  = () => setScreen(s => Math.min(s + 1, 6))
  const back  = () => setScreen(s => Math.max(s - 1, 0))
  const reset = () => { setInputs(BLANK_INPUTS); setScreen(0) }

  async function saveCurrentCustomer() {
    setSaving(true)
    setSaveError(null)
    try {
      // Pass activeCustomer.id so saveLoan always links the event to the correct customer
      const customer = await saveLoan(inputs, activeCustomer?.id || null)
      const cid = customer.customer_id
      activateCustomer({
        ...(activeCustomer || {}),
        id:             cid,
        stage:          'roi_shown',
        roiFilled:      true,
        savedROIInputs: inputs,   // preserve just-saved inputs so form re-opens with data
      })
    } catch (err) {
      setSaveError(err.message || 'Save failed. Please try again.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const loadCustomer = savedInputs => { setInputs(savedInputs); setScreen(0) }

  return (
    <AppContext.Provider value={{
      inputs, setInputs, update, toggleProblem, toggleSubProblem,
      screen, next, back, reset,
      saveCurrentCustomer, saving, saveError,
      loadCustomer,

      // Main screen routing
      mainScreen, setMainScreen,

      // Active Customer
      activeCustomer,
      customerId,
      activateCustomer,
      updateActiveCustomer,
      clearActiveCustomer,
      resetCustomer,
      // backward-compat shim so existing code that calls setCustomerId still works
      setCustomerId: (id) => updateActiveCustomer({ id }),

      // Modal flags
      savedCustomersOpen, openSavedCustomers: () => setSavedCustomersOpen(true),  closeSavedCustomers: () => setSavedCustomersOpen(false),
      dashboardOpen,      openDashboard:      () => setDashboardOpen(true),       closeDashboard:      () => setDashboardOpen(false),
      assistantOpen,      openAssistant:      () => setAssistantOpen(true),       closeAssistant:      () => setAssistantOpen(false),
      painDiscoveryOpen,  openPainDiscovery:  () => setPainDiscoveryOpen(true),   closePainDiscovery:  () => setPainDiscoveryOpen(false),

      customerFormInitialData,
      customerFormOpen,
      openCustomerForm:        () => { setCustomerFormInitialData(null); setCustomerFormOpen(true) },
      openCustomerFormForEdit: (d)  => { setCustomerFormInitialData(d); setCustomerFormOpen(true) },
      closeCustomerForm:       () => { setCustomerFormInitialData(null); setCustomerFormOpen(false) },

      quickCreateOpen,
      openQuickCreate:  () => setQuickCreateOpen(true),
      closeQuickCreate: () => setQuickCreateOpen(false),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
