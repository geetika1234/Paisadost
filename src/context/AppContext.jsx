import { createContext, useContext, useState } from 'react'
import { DEFAULT_INPUTS } from '../logic/calculations'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [screen, setScreen] = useState(0)

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

  const next = () => setScreen(s => Math.min(s + 1, 6))
  const back = () => setScreen(s => Math.max(s - 1, 0))

  return (
    <AppContext.Provider value={{ inputs, update, toggleProblem, screen, next, back }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
