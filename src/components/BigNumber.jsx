/**
 * BigNumber — hero number display card
 * Props: label, value (string), color ('red'|'green'|'gold'|'brand'), size ('sm'|'lg')
 */
export default function BigNumber({ label, value, sub, color = 'brand', size = 'lg', animate }) {
  const colors = {
    red:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', label: '#991B1B' },
    green: { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A', label: '#14532D' },
    gold:  { bg: '#FFFBEB', border: '#FCD34D', text: '#D97706', label: '#92400E' },
    brand: { bg: '#EEF2FF', border: '#A5B4FC', text: '#4338CA', label: '#3730A3' },
  }
  const c = colors[color] ?? colors.brand

  return (
    <div
      className={`rounded-2xl border-2 p-4 mb-3 ${animate ? 'pulse-in' : ''}`}
      style={{ background: c.bg, borderColor: c.border }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: c.label }}>
        {label}
      </p>
      <p
        className={`font-extrabold leading-none ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}
        style={{ color: c.text }}
      >
        {value}
      </p>
      {sub && <p className="text-xs mt-1 font-medium" style={{ color: c.label }}>{sub}</p>}
    </div>
  )
}
