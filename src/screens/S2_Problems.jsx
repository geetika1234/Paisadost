import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'

const PROBLEMS = [
  {
    tag: 'STOCK_OUT',
    emoji: '📦',
    title: 'Maal Khatam Ho Jaata Hai',
    sub: 'Customers aate hain, maal nahi hota',
  },
  {
    tag: 'WORKING_CAPITAL',
    emoji: '💸',
    title: 'Paison Ki Kami Hoti Hai',
    sub: 'Mahine ke end mein cash nahi bachta',
  },
  {
    tag: 'EXPANSION',
    emoji: '🏪',
    title: 'Dukaan Bada Karna Hai',
    sub: 'Naya counter, zyada maal, naya area',
  },
  {
    tag: 'CAPEX',
    emoji: '⚙️',
    title: 'Machine / Equipment Chahiye',
    sub: 'Fridge, counter, AC, machine, etc.',
  },
  {
    tag: 'SEASONAL',
    emoji: '📈',
    title: 'Season Mein Zyada Bikri Hoti Hai',
    sub: 'Festival, tyohar — us waqt paisa nahi hota',
  },
  {
    tag: 'COMPETITION',
    emoji: '🏃',
    title: 'Competitor Aage Nikal Raha Hai',
    sub: 'Paas mein naya competitor aa gaya',
  },
]

export default function S2_Problems() {
  const { inputs, toggleProblem, next, back, screen } = useApp()
  const selected = inputs.problems

  return (
    <ScreenShell
      title="Kahan Ruk Raha Hai Business?"
      subtitle="Jo bhi sahi lage woh chuno — ek se zyada bhi chalo"
      step={screen}
      total={7}
      onBack={back}
      cta={selected.length > 0 ? `${selected.length} Problem${selected.length > 1 ? 'ein' : ''} — Nuksaan Dekho →` : 'Koi Ek Chuno'}
      ctaDisabled={selected.length === 0}
      onCta={next}
    >
      <div className="space-y-3">
        {PROBLEMS.map(p => {
          const active = selected.includes(p.tag)
          return (
            <button
              key={p.tag}
              onClick={() => toggleProblem(p.tag)}
              className={`problem-tile w-full rounded-2xl p-4 text-left border-2 transition-all
                ${active
                  ? 'border-brand bg-indigo-50'
                  : 'border-slate-200 bg-white'
                }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{p.emoji}</span>
                <div className="flex-1">
                  <p className={`font-bold text-base ${active ? 'text-brand' : 'text-slate-800'}`}>
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.sub}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center
                  ${active ? 'bg-brand border-brand' : 'border-slate-300'}`}>
                  {active && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 bg-indigo-50 rounded-2xl p-4 border border-indigo-200">
          <p className="text-sm font-semibold text-brand">
            🎯 {selected.length} problem{selected.length > 1 ? 'ein' : ''} select ki — ab dekhte hain kitna nuksaan ho raha hai.
          </p>
        </div>
      )}
    </ScreenShell>
  )
}
