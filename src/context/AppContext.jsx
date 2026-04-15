import { createContext, useContext, useState } from 'react'
import { DEFAULT_INPUTS, BLANK_INPUTS } from '../logic/calculations'
import { saveLoan } from '../lib/db/loans'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [inputs,     setInputs]     = useState(DEFAULT_INPUTS)
  const [screen,     setScreen]     = useState(0)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  // ── Shared customer ID ────────────────────────────────────────────────────
  // Set after Engagement Form or ROI Save.
  // Pain Discovery and ROI tool both read this to link events to the same customer.
  const [customerId, setCustomerId] = useState(null)

  // ── Modal flags ───────────────────────────────────────────────────────────
  const [assistantOpen,           setAssistantOpen]           = useState(false)
  const [painDiscoveryOpen,       setPainDiscoveryOpen]       = useState(false)
  const [customerFormOpen,        setCustomerFormOpen]        = useState(false)
  const [customerFormInitialData, setCustomerFormInitialData] = useState(null)
  const [savedCustomersOpen,      setSavedCustomersOpen]      = useState(false)
  const [dashboardOpen,           setDashboardOpen]           = useState(false)

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

  /**
   * saveCurrentCustomer()
   * Called from S1_BusinessDetails "Save Karen" button (ROI tool).
   * 1. Upserts customer → sets shared customerId
   * 2. Adds roi_shown event with full inputs JSON
   * 3. Upserts loan record
   */
  async function saveCurrentCustomer() {
    setSaving(true)
    setSaveError(null)
    try {
      const customer = await saveLoan(inputs)
      setCustomerId(customer.customer_id)   // share with Pain Discovery
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
      inputs, update, toggleProblem, toggleSubProblem,
      screen, next, back, reset,
      saveCurrentCustomer, saving, saveError,
      loadCustomer,
      // Shared customer ID — set by Engagement Form or ROI Save
      customerId, setCustomerId,
      savedCustomersOpen, openSavedCustomers: () => setSavedCustomersOpen(true),  closeSavedCustomers: () => setSavedCustomersOpen(false),
      dashboardOpen,      openDashboard:      () => setDashboardOpen(true),       closeDashboard:      () => setDashboardOpen(false),
      assistantOpen,      openAssistant:      () => setAssistantOpen(true),       closeAssistant:      () => setAssistantOpen(false),
      painDiscoveryOpen,  openPainDiscovery:  () => setPainDiscoveryOpen(true),   closePainDiscovery:  () => setPainDiscoveryOpen(false),
      customerFormInitialData,
      customerFormOpen,
      openCustomerForm:        () => { setCustomerFormInitialData(null); setCustomerFormOpen(true) },
      openCustomerFormForEdit: (d)  => { setCustomerFormInitialData(d); setCustomerFormOpen(true) },
      closeCustomerForm:       () => { setCustomerFormInitialData(null); setCustomerFormOpen(false) },
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
