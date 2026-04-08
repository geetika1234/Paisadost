import { createContext, useContext, useState } from 'react'
import { DEFAULT_INPUTS, BLANK_INPUTS } from '../logic/calculations'
import { saveCustomer } from '../logic/customerStorage'
import { getCurrentUser, trackVisit } from '../logic/dashboardStorage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [screen, setScreen] = useState(0)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [painDiscoveryOpen, setPainDiscoveryOpen] = useState(false)
  const [customerFormOpen, setCustomerFormOpen]   = useState(false)
  const [savedCustomersOpen, setSavedCustomersOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)

  function update(key, value) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function toggleProblem(tag) {
    setInputs(prev => {
      const has = prev.problems.includes(tag)
      return {
        ...prev,
        problems: has
          ? prev.problems.filter(p => p !== tag)
          : [...prev.problems, tag],
      }
    })
  }

  function toggleSubProblem(parentTag, subTag) {
    setInputs(prev => {
      const hasSub    = prev.subProblems.includes(subTag)
      const hasParent = prev.problems.includes(parentTag)
      return {
        ...prev,
        // auto-select parent when sub is selected
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
  const saveCurrentCustomer = () => {
    saveCustomer(inputs)
    const user = getCurrentUser()
    if (user) trackVisit(user)
  }
  const loadCustomer = savedInputs => { setInputs(savedInputs); setScreen(0) }

  return (
    <AppContext.Provider value={{ inputs, update, toggleProblem, toggleSubProblem, screen, next, back, reset, saveCurrentCustomer, loadCustomer, savedCustomersOpen, openSavedCustomers: () => setSavedCustomersOpen(true), closeSavedCustomers: () => setSavedCustomersOpen(false), dashboardOpen, openDashboard: () => setDashboardOpen(true), closeDashboard: () => setDashboardOpen(false), assistantOpen, openAssistant: () => setAssistantOpen(true), closeAssistant: () => setAssistantOpen(false), painDiscoveryOpen, openPainDiscovery: () => setPainDiscoveryOpen(true), closePainDiscovery: () => setPainDiscoveryOpen(false), customerFormOpen, openCustomerForm: () => setCustomerFormOpen(true), closeCustomerForm: () => setCustomerFormOpen(false) }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
