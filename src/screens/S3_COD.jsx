import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import Drawer from '../components/Drawer'
import { calculateCOD, fmtINR, fmtINRFull } from '../logic/calculations'

const PROBLEM_MAP = {
  STOCK_OUT:       ['missedDiscount', 'competitorProfit'],
  WORKING_CAPITAL: ['totalUdhariLoss', 'inflationLoss'],
  EXPANSION:       ['avgSeasonLossMonth', 'inflationLoss'],
  CAPEX:           ['monthlyExpenseRise'],
  SEASONAL:        ['avgSeasonLossMonth'],
  COMPETITION:     ['competitorProfit'],
}

const COMPONENTS = [
  {
    key:   'missedDiscount',
    icon:  '🏷️',
    label: 'Supplier Discount Nahi Mila',
    sub:   'Cash nahi tha toh bulk mein nahi khareed paye',
    color: '#92400E',
    bg:    '#FFFBEB',
    bar:   '#F59E0B',
  },
  {
    key:   'competitorProfit',
    icon:  '🏃',
    label: 'Customers Competitor Ke Paas Gaye',
    sub:   'Stock khatam tha toh customer dusri dukaan gaya',
    color: '#B91C1C',
    bg:    '#FEF2F2',
    bar:   '#EF4444',
  },
  {
    key:   'totalUdhariLoss',
    icon:  '📒',
    label: 'Zyada Udhari Se Nuksaan',
    sub:   'Excess outstanding amount kaam nahi kar raha',
    color: '#1E40AF',
    bg:    '#EFF6FF',
    bar:   '#3B82F6',
  },
  {
    key:   'monthlyExpenseRise',
    icon:  '📊',
    label: 'Fixed Kharche Badhne Se Nuksaan',
    sub:   'Rent, salary, bijli — saal-dar-saal badhte hain',
    color: '#5B21B6',
    bg:    '#F5F3FF',
    bar:   '#8B5CF6',
  },
  {
    key:   'inflationLoss',
    icon:  '💹',
    label: 'Mehengai Se Profit Ghata',
    sub:   'Same kamaai, lekin rupaye ki value kam hoti hai',
    color: '#9D174D',
    bg:    '#FDF2F8',
    bar:   '#EC4899',
  },
  {
    key:   'stockPriceRiseMonth',
    icon:  '⬆️',
    label: 'Supplier Ne Maal Mehanga Kiya',
    sub:   'Har saal supplier rate badha deta hai',
    color: '#065F46',
    bg:    '#ECFDF5',
    bar:   '#10B981',
  },
  {
    key:   'avgSeasonLossMonth',
    icon:  '📅',
    label: 'Season Mein Maal Khatam Hua',
    sub:   'Tyohar/peak mein stock nahi tha',
    color: '#1D4ED8',
    bg:    '#EFF6FF',
    bar:   '#60A5FA',
  },
]

function DrawerItem({ item, valueColor, sign = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.icon}</span>
          <p className="text-sm font-bold text-slate-800">{item.head}</p>
        </div>
        <p className={`text-sm font-extrabold flex-shrink-0 ${valueColor}`}>{sign}₹{Math.round(item.result).toLocaleString('en-IN')}/mah</p>
      </div>
      <p className="text-xs text-slate-500 mb-1.5">{item.body}</p>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-indigo-500 font-semibold flex items-center gap-1"
      >
        <span>{open ? '▲' : '▼'}</span> {open ? 'Close' : 'Calculation dekhein'}
      </button>
      {open && (
        <div className="bg-white px-3 py-2 rounded-lg mt-1.5 space-y-2">
          {item.calc.split('\n\n').map((section, i) => {
            const lines = section.split('\n')
            const isHeader = lines[0].endsWith(':')
            return (
              <div key={i}>
                {isHeader && (
                  <p className="text-xs font-bold text-slate-500 mb-0.5">{lines[0]}</p>
                )}
                {lines.slice(isHeader ? 1 : 0).map((line, j) => (
                  <p key={j} className="text-xs font-mono text-slate-600 leading-relaxed">{line}</p>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function S3_COD() {
  const { inputs, next, back, screen } = useApp()
  const [drawer, setDrawer] = useState(false)

  const cod = calculateCOD(inputs)
  const highlighted = new Set(inputs.problems.flatMap(p => PROBLEM_MAP[p] ?? []))

  // ── Exact calculation figures for each source ──
  const totalDiscPct = (inputs.bulkDiscount ?? 0) + (inputs.schemeDiscount ?? 0) + (inputs.cashDiscount ?? 0)
  const cycles       = 365 / inputs.stockRotationDays
  const mthlyProfit  = inputs.monthlySales * inputs.profitMargin / 100
  const r = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

  const calcLines = {
    missedDiscount: (() => {
      const stockFromLoan = inputs.loanAmount * ((inputs.businessLoanPct ?? 100) / 100)
      const bulkStock = stockFromLoan * 0.60
      return `${r(stockFromLoan)} loan stock × 60% utilization = ${r(bulkStock)} bulk stock × ${totalDiscPct}% discount × ${cycles.toFixed(1)} rotations/yr ÷ 12 = ${r(cod.missedDiscount)}/mah`
    })(),
    competitorProfit: (() => {
      const lost = Math.round((inputs.dailyWalkins ?? 0) * (inputs.lostCustomersPct ?? 0) / 100)
      return `${inputs.dailyWalkins} walkins × ${inputs.lostCustomersPct}% = ${lost} lost/din × ${r(inputs.avgBillValue)} × 30 days × ${inputs.profitMargin}% margin × 40% = ${r(cod.competitorProfit)}/mah`
    })(),
    totalUdhariLoss: (() => {
      const f = fmtINRFull
      const { idealUdhariDays: id } = inputs
      const raw = cod.totalUdhariLoss / 0.60

      if (cod.excessUdhari > 0) {
        return [
          `Part 1 — Excess udhari × ideal din (${id}):`,
          `  Excess = ${f(inputs.actualUdhari)} − ${f(cod.idealUdhari)} = ${f(cod.excessUdhari)}`,
          `  Business = (${f(cod.excessUdhari)} × ${inputs.profitMargin}% ÷ 30) × ${id} = ${f(cod.part1Profit)}`,
          `  Interest  = (${f(cod.excessUdhari)} × 1% ÷ 30) × ${id} = ${f(cod.part1Interest)}`,
          ``,
          `Part 2 — Actual udhari × extra credit din (${cod.excessCreditDays}):`,
          `  Extra din = ${inputs.creditDaysGiven} − ${id} = ${cod.excessCreditDays}`,
          `  Business = (${f(inputs.actualUdhari)} × ${inputs.profitMargin}% ÷ 30) × ${cod.excessCreditDays} = ${f(cod.part2Profit)}`,
          `  Interest  = (${f(inputs.actualUdhari)} × 1% ÷ 30) × ${cod.excessCreditDays} = ${f(cod.part2Interest)}`,
          ``,
          `Total = ${f(raw)} × 60% realization = ${f(cod.totalUdhariLoss)}/mah`,
        ].join('\n')
      }
      if (cod.excessCreditDays > 0) {
        return [
          `Extra credit din = ${inputs.creditDaysGiven} − ${id} = ${cod.excessCreditDays}`,
          `  Business = (${f(inputs.actualUdhari)} × ${inputs.profitMargin}% ÷ 30) × ${cod.excessCreditDays} = ${f(cod.part2Profit)}`,
          `  Interest  = (${f(inputs.actualUdhari)} × 1% ÷ 30) × ${cod.excessCreditDays} = ${f(cod.part2Interest)}`,
          ``,
          `Total = ${f(raw)} × 60% realization = ${f(cod.totalUdhariLoss)}/mah`,
        ].join('\n')
      }
      return `Credit days = ideal days — koi udhari loss nahi`
    })(),
    monthlyExpenseRise:
      `(${r(inputs.rent)} rent + ${r(inputs.electricity)} bijli + ${r(inputs.salaries)} salary) × ${inputs.expenseGrowthPct}% = ${r(cod.monthlyExpenseRise)}/mah`,
    inflationLoss:
      `${r(mthlyProfit)} monthly profit × ${inputs.inflationRate}% inflation = ${r(cod.inflationLoss)}/mah`,
    stockPriceRiseMonth: (() => {
      const stockFromLoan = inputs.loanAmount * ((inputs.businessLoanPct ?? 100) / 100)
      const rotations = 365 / inputs.stockRotationDays
      return `(${r(stockFromLoan)} loan stock × ${rotations.toFixed(1)} rotations/yr) ÷ 12 × ${inputs.stockPriceIncreasePct}% price rise × ${inputs.profitMargin}% margin × 70% = ${r(cod.stockPriceRiseMonth)}/mah`
    })(),
    avgSeasonLossMonth:
      `${r(inputs.monthlySales)} × ${inputs.seasonUplift}% uplift × ${inputs.seasonMonths} mah × ${inputs.profitMargin}% ÷ 12 × 60% = ${r(cod.avgSeasonLossMonth)}/mah`,
  }

  // Sort: highlighted first, then by value desc
  const sorted = [...COMPONENTS].sort((a, b) => {
    const aH = highlighted.has(a.key), bH = highlighted.has(b.key)
    if (aH && !bH) return -1
    if (!aH && bH) return 1
    return (cod[b.key] ?? 0) - (cod[a.key] ?? 0)
  }).filter(c => (cod[c.key] ?? 0) > 0)

  // Stacked bar segments
  const segments = sorted.map(c => ({
    ...c,
    val: cod[c.key] ?? 0,
    pct: cod.monthlyCoD > 0 ? ((cod[c.key] ?? 0) / cod.monthlyCoD) * 100 : 0,
  }))

  return (
    <ScreenShell
      title="Aapka Nuksaan 🔴"
      subtitle="Loan nahi liya toh yeh paisa roz khota rahega"
      step={screen}
      total={7}
      onBack={back}
      cta="Ab Faida Dekho →"
      ctaColor="green"
      onCta={next}
    >

      {/* ── Hero card ── */}
      <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl p-4 mb-3 text-white shadow-md">
        <p className="text-xs font-semibold text-red-300 uppercase tracking-widest mb-1">Ek Saal Mein Total Nuksaan</p>
        <p className="text-5xl font-extrabold leading-none">{fmtINR(cod.annualCoD)}</p>
        <p className="text-xs text-red-400 mt-1 mb-3">agar aaj bhi kuch nahi kiya</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: '1 Mah', val: cod.monthlyCoD },
            { label: '3 Mah', val: cod.quarterlyCoD },
            { label: '6 Mah', val: cod.monthlyCoD * 6 },
          ].map(t => (
            <div key={t.label} className="bg-black/20 rounded-lg p-2 text-center">
              <p className="text-xs text-red-300 font-medium">{t.label}</p>
              <p className="text-sm font-extrabold">{fmtINR(t.val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Breakdown card: stacked bar + source rows ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-3 overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nuksaan Kahan Se Ho Raha Hai?</p>
          {/* Stacked bar */}
          <div className="flex rounded-lg overflow-hidden h-3 mb-2 gap-px">
            {segments.map(s => (
              <div key={s.key} style={{ width: `${s.pct}%`, background: s.bar }} title={`${s.label}: ${Math.round(s.pct)}%`} />
            ))}
          </div>
          {/* Legend dots */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {segments.map(s => (
              <div key={s.key} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.bar }} />
                <span className="text-xs text-slate-400">{s.icon} {Math.round(s.pct)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source cards */}
        <div className="px-3 pb-3 space-y-2">
          {segments.map(s => {
            const isHL = highlighted.has(s.key)
            return (
              <div
                key={s.key}
                className="rounded-xl border p-3"
                style={{
                  borderColor: isHL ? s.bar : '#F1F5F9',
                  background: isHL ? s.bg : '#FAFAFA',
                }}
              >
                <div className="flex items-center gap-2.5">
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  {/* Label + sub + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-xs font-bold leading-snug" style={{ color: isHL ? s.color : '#374151' }}>{s.label}</p>
                      {isHL && <span className="text-xs flex-shrink-0">⚠️</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.bar }} />
                      </div>
                      <span className="text-xs font-semibold w-7 text-right flex-shrink-0" style={{ color: s.bar }}>{Math.round(s.pct)}%</span>
                    </div>
                  </div>
                  {/* Value */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold" style={{ color: isHL ? s.color : '#6B7280' }}>
                      ₹{Math.round(s.val).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400">/mah</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total row */}
        <div className="bg-red-900 px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-red-300 font-semibold uppercase tracking-widest">Total Monthly</p>
            <p className="text-xs text-red-400">₹{Math.round(cod.dailyCoD).toLocaleString('en-IN')}/din</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-white">{fmtINR(cod.monthlyCoD)}</p>
            <p className="text-xs text-red-300">₹{Math.round(cod.monthlyCoD).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* ── Explain button ── */}
      <button
        onClick={() => setDrawer(true)}
        className="w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 bg-white flex items-center justify-center gap-2 mb-1"
      >
        <span>🤔</span> Yeh Kaise Calculate Hua? Samjhao
      </button>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Nuksaan Kaise Hota Hai?">
        <p className="mb-4 text-sm text-slate-600">
          <strong>Jab aapke paas paise nahi hote</strong>, toh 7 tarah se nuksaan hota hai — aapke numbers se:
        </p>
        <div className="space-y-3">
          {[
            {
              icon: '🏷️', head: 'Discount nahi mila',
              body: 'Bulk mein kharidoge toh supplier 5-10% discount deta — cash nahi tha toh yeh gaya',
              calc: calcLines.missedDiscount,
              result: cod.missedDiscount,
            },
            {
              icon: '🏃', head: 'Customer chala gaya',
              body: 'Stock nahi hota toh customer competitor ke paas jaata hai — woh paisa phir wapas nahi aata',
              calc: calcLines.competitorProfit,
              result: cod.competitorProfit,
            },
            {
              icon: '📒', head: 'Udhari ka nuksaan',
              body: 'Jo paisa customers ko de rakha hai — woh paisa kaam nahi kar raha, interest bhi jaa raha hai',
              calc: calcLines.totalUdhariLoss,
              result: cod.totalUdhariLoss,
            },
            {
              icon: '📊', head: 'Kharche badhte hain',
              body: 'Rent, bijli, salary — saal-dar-saal badhte hain, income nahi badhi toh nuksaan',
              calc: calcLines.monthlyExpenseRise,
              result: cod.monthlyExpenseRise,
            },
            {
              icon: '💹', head: 'Mehengai khata hai',
              body: 'Same profit aaj ki value mein kal kam hoga — rupaye ki value ghatti hai',
              calc: calcLines.inflationLoss,
              result: cod.inflationLoss,
            },
            {
              icon: '⬆️', head: 'Maal mehanga hua',
              body: 'Supplier zyada charge karne laga — aapka margin seedha ghatta',
              calc: calcLines.stockPriceRiseMonth,
              result: cod.stockPriceRiseMonth,
            },
            {
              icon: '📅', head: 'Season miss hua',
              body: 'Diwali, Eid, navratri mein zyada bikri hoti — stock nahi tha toh mauka gaya',
              calc: calcLines.avgSeasonLossMonth,
              result: cod.avgSeasonLossMonth,
            },
          ].filter(item => item.result > 0).map(item => (
            <DrawerItem key={item.head} item={item} valueColor="text-red-600" />
          ))}
        </div>
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
          <p className="text-sm font-bold text-red-800">Total Monthly Nuksaan</p>
          <div className="text-right">
            <p className="text-lg font-extrabold text-red-700">{fmtINR(cod.monthlyCoD)}/mah</p>
            <p className="text-xs text-red-400 font-semibold">₹{Math.round(cod.monthlyCoD).toLocaleString('en-IN')}/mah</p>
          </div>
        </div>
      </Drawer>
    </ScreenShell>
  )
}
