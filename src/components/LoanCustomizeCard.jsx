import { useState } from 'react'
import { useApp } from '../context/AppContext'
import RangeSlider from './RangeSlider'
import { calculateROI, fmtINR } from '../logic/calculations'

const TENURE_OPTIONS = [12, 18, 24, 36, 48, 60, 72, 84]

export default function LoanCustomizeCard() {
  const { inputs, update } = useApp()
  const [open, setOpen] = useState(false)
  const roi    = calculateROI(inputs)
  const bizPct = inputs.businessLoanPct ?? 100
  const persPct = 100 - bizPct

  const done = inputs.loanAmount > 0 && inputs.tenureMonths > 0

  return (
    <div className={`bg-white rounded-2xl border shadow-sm mb-3 overflow-hidden ${done ? 'border-indigo-200' : 'border-slate-100'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎛️</span>
          <span className={`text-sm font-bold ${done ? 'text-indigo-700' : 'text-slate-700'}`}>Loan Customize Karo</span>
          {done && (
            <span className="text-xs bg-indigo-100 text-brand px-2 py-0.5 rounded-full font-semibold">
              {fmtINR(inputs.loanAmount)} · {inputs.tenureMonths}M
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {done && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold leading-none">✓</span>
          )}
          <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50">
          <RangeSlider
            label="Loan Kitna Chahiye?"
            value={inputs.loanAmount}
            min={200000} max={2100000} step={25000}
            onChange={v => update('loanAmount', v)}
            hint="₹2L se ₹21L tak"
          />

          {/* Tenure grid */}
          <div className="mb-5">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-slate-600">Kitne Mahine Mein Bharoge?</span>
              <span className="text-lg font-bold text-brand">{inputs.tenureMonths} mahine</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {TENURE_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => update('tenureMonths', t)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-all
                    ${inputs.tenureMonths === t
                      ? 'border-brand bg-indigo-50 text-brand'
                      : 'border-slate-200 text-slate-500 bg-white'}`}
                >
                  {t}M
                </button>
              ))}
            </div>
          </div>

          <RangeSlider
            label="Byaaj (Interest Rate)"
            value={inputs.interestRate}
            min={18} max={25} step={0.5}
            onChange={v => update('interestRate', v)}
            format="pct"
            hint={`18% se 25% ke beech (reducing) — Flat rate: ~${((roi.totalInterest / inputs.loanAmount) / (inputs.tenureMonths / 12) * 100).toFixed(1)}% p.a.`}
          />

          {/* Business vs Personal loan split */}
          <div className="mb-5">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-medium text-slate-600">Loan Kitna Business Ke Liye?</span>
              <span className="text-lg font-bold text-brand">{bizPct}%</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={0} max={100} step={5}
                value={bizPct}
                onChange={e => update('businessLoanPct', Number(e.target.value))}
                style={{ background: `linear-gradient(to right, #4338CA ${bizPct}%, #E2E8F0 ${bizPct}%)` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs">
              <span>{bizPct === 0 ? '₹0' : fmtINR(inputs.loanAmount * bizPct / 100)}</span>
              <span>{fmtINR(inputs.loanAmount)}</span>
            </div>
            <div className="flex rounded-lg overflow-hidden h-3 mt-2 gap-px">
              {bizPct > 0 && (
                <div style={{ width: `${bizPct}%`, background: '#4338CA' }} className="flex items-center justify-center">
                  {bizPct >= 20 && <span className="text-white text-[9px] font-bold">Business {bizPct}%</span>}
                </div>
              )}
              {persPct > 0 && (
                <div style={{ width: `${persPct}%`, background: '#F43F5E' }} className="flex items-center justify-center">
                  {persPct >= 20 && <span className="text-white text-[9px] font-bold">Personal {persPct}%</span>}
                </div>
              )}
            </div>
            {persPct > 0 && (
              <p className="text-xs text-slate-400 mt-1">ROI sirf business hisse ({bizPct}%) pe calculate hoga</p>
            )}
          </div>

          <RangeSlider
            label="Parivar Ki Amdani (Family Income) / Mahine"
            value={inputs.familyIncome ?? 0}
            min={0} max={200000} step={5000}
            onChange={v => update('familyIncome', v)}
            hint="Personal EMI afford karne ke liye (job, rent, etc.)"
          />
        </div>
      )}
    </div>
  )
}
