import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import { PROBLEMS } from '../logic/problems'

export default function S2_Problems() {
  const { inputs, toggleProblem, toggleSubProblem, next, back, screen } = useApp()
  const selected    = inputs.problems
  const selectedSub = inputs.subProblems
  const [expanded, setExpanded] = useState({})

  const totalSelected = selected.length + selectedSub.length

  function toggleExpand(tag) {
    setExpanded(e => ({ ...e, [tag]: !e[tag] }))
  }

  return (
    <ScreenShell
      title="Kahan Ruk Raha Hai Business?"
      subtitle="Category chuno — andar sub-problem bhi select kar sakte ho"
      step={screen}
      total={7}
      onBack={back}
      cta={selected.length > 0 ? `${selected.length} Problem${selected.length > 1 ? 'ein' : ''} — Nuksaan Dekho →` : 'Koi Ek Chuno'}
      ctaDisabled={selected.length === 0}
      onCta={next}
    >
      <div className="space-y-2">
        {PROBLEMS.map(p => {
          const active      = selected.includes(p.tag)
          const isExpanded  = expanded[p.tag]
          const hasSubs     = p.subProblems.length > 0
          const activeSubs  = p.subProblems.filter(sp => selectedSub.includes(sp.tag))

          return (
            <div key={p.tag}>
              {/* Main tile */}
              <div className={`w-full rounded-2xl border-2 transition-all overflow-hidden
                ${active ? 'border-brand bg-indigo-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center">
                  {/* Select area */}
                  <button
                    className="flex-1 p-4 text-left flex items-start gap-3"
                    onClick={() => {
                      toggleProblem(p.tag)
                      if (!active && hasSubs) setExpanded(e => ({ ...e, [p.tag]: true }))
                    }}
                  >
                    <span className="text-3xl leading-none">{p.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${active ? 'text-brand' : 'text-slate-800'}`}>
                        {p.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.sub}</p>
                      {activeSubs.length > 0 && (
                        <p className="text-xs text-indigo-600 font-semibold mt-1">
                          {activeSubs.length} sub-problem{activeSubs.length > 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center
                      ${active ? 'bg-brand border-brand' : 'border-slate-300'}`}>
                      {active && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                  </button>

                  {/* Expand arrow */}
                  {hasSubs && (
                    <button
                      onClick={() => toggleExpand(p.tag)}
                      className={`px-3 py-4 text-sm border-l transition-all
                        ${active ? 'border-indigo-200 text-indigo-400' : 'border-slate-200 text-slate-400'}`}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {/* Sub-problems */}
                {hasSubs && isExpanded && (
                  <div className={`border-t space-y-0 ${active ? 'border-indigo-200' : 'border-slate-200'}`}>
                    {p.subProblems.map((sp, i) => {
                      const subActive = selectedSub.includes(sp.tag)
                      return (
                        <button
                          key={sp.tag}
                          onClick={() => toggleSubProblem(p.tag, sp.tag)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                            ${i > 0 ? 'border-t border-slate-100' : ''}
                            ${subActive ? 'bg-indigo-100' : 'bg-white/60'}`}
                        >
                          {/* Indent indicator */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-3 h-px bg-slate-300" />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                              ${subActive ? 'bg-brand border-brand' : 'border-slate-300 bg-white'}`}>
                              {subActive && <span className="text-white text-[9px] font-bold">✓</span>}
                            </div>
                          </div>
                          <span className={`text-xs font-medium flex-1 ${subActive ? 'text-indigo-700' : 'text-slate-600'}`}>
                            {sp.label}
                          </span>
                          {subActive && (
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 border border-indigo-200 rounded-full px-2 py-0.5 flex-shrink-0">
                              Sub
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalSelected > 0 && (
        <div className="mt-4 bg-indigo-50 rounded-2xl p-4 border border-indigo-200">
          <p className="text-sm font-semibold text-brand">
            🎯 {selected.length} problem{selected.length > 1 ? 'ein' : ''}
            {selectedSub.length > 0 ? ` · ${selectedSub.length} sub-problem${selectedSub.length > 1 ? 's' : ''}` : ''} select ki — ab dekhte hain kitna nuksaan ho raha hai.
          </p>
        </div>
      )}
    </ScreenShell>
  )
}
