import { fmtINR } from '../logic/calculations'

/**
 * RangeSlider
 * Props: label, value, min, max, step, onChange, format ('inr' | 'pct' | 'days' | 'months')
 */
export default function RangeSlider({ label, value, min, max, step = 1, onChange, format = 'inr', hint }) {
  const pct = ((value - min) / (max - min)) * 100

  function display(v) {
    if (format === 'pct')    return `${v}%`
    if (format === 'days')   return `${v} din`
    if (format === 'months') return `${v} mahine`
    if (format === 'count')  return `${v}`
    return fmtINR(v)
  }

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-lg font-bold text-brand">{display(value)}</span>
      </div>
      {hint && <p className="text-xs text-slate-400 mb-1">{hint}</p>}
      <div className="relative">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, #4338CA ${pct}%, #E2E8F0 ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{display(min)}</span>
        <span>{display(max)}</span>
      </div>
    </div>
  )
}
