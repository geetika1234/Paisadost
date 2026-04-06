import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import RangeSlider from '../components/RangeSlider'
import Drawer from '../components/Drawer'
import LoanCustomizeCard from '../components/LoanCustomizeCard'
import { calculateROI, fmtINR, fmtINRFull } from '../logic/calculations'


const GAIN_SOURCES = [
  {
    key:   'avgMonthlyProfit',
    icon:  '📦',
    label: 'Zyada Maal → Zyada Bikri',
    sub:   'Loan se stock full, cycle fast — har rotation pe profit',
    color: '#065F46',
    bg:    '#ECFDF5',
    bar:   '#10B981',
  },
  {
    key:   'discountRecovered',
    icon:  '🏷️',
    label: 'Supplier Discount Wapas Mila',
    sub:   'Bulk mein kharidoge toh 5-10% discount seedha pocket mein',
    color: '#1E40AF',
    bg:    '#EFF6FF',
    bar:   '#3B82F6',
  },
  {
    key:   'competitorRecovered',
    icon:  '🏃',
    label: 'Competitor Se Customer Wapas',
    sub:   'Stock poora tha toh koi bhi gaya nahi',
    color: '#5B21B6',
    bg:    '#F5F3FF',
    bar:   '#8B5CF6',
  },
  {
    key:   'cashCycleGain',
    icon:  '🔄',
    label: 'Cash Flow Smooth Hua',
    sub:   'Operations better hone se 10% extra efficiency',
    color: '#92400E',
    bg:    '#FFFBEB',
    bar:   '#F59E0B',
  },
]

function ROIDrawerItem({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.icon}</span>
          <p className="text-sm font-bold text-slate-800">{item.head}</p>
        </div>
        <p className="text-sm font-extrabold text-green-600 flex-shrink-0">+₹{Math.round(item.result).toLocaleString('en-IN')}/mah</p>
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

export default function S4_ROI() {
  const { inputs, update, next, back, screen } = useApp()
  const [drawer, setDrawer] = useState(false)
  const [showCharges, setShowCharges] = useState(false)

  const roi = calculateROI(inputs)

  // Loan split
  const bizPct           = inputs.businessLoanPct ?? 100
  const persPct          = 100 - bizPct
  const businessEMI      = roi.emiAmount * bizPct / 100
  const personalEMI      = roi.emiAmount * persPct / 100

  // Business affordability: business EMI vs net business kamaai
  const grossMargin      = inputs.monthlySales * inputs.profitMargin / 100
  const totalFixedExp    = (inputs.rent ?? 0) + (inputs.electricity ?? 0) + (inputs.salaries ?? 0)
  const rawNetBizKamaai  = grossMargin - totalFixedExp                        // real value, can be negative
  const netBizKamaai     = Math.max(1, rawNetBizKamaai)                       // clamped only for % calc

  // Total EMI = existing + new loan EMI
  const familyInc        = inputs.familyIncome ?? 0
  const totalEMI         = (inputs.existingLoan ? (inputs.existingEMI ?? 0) : 0) + roi.emiAmount
  const bizEMITotal      = businessEMI + (inputs.existingLoan ? (inputs.existingEMI ?? 0) : 0)

  // Full household income (real, can be negative)
  const rawFullIncome    = rawNetBizKamaai + familyInc
  const fullIncome       = Math.max(1, rawFullIncome)                         // clamped only for % calc

  const bizEmiPct        = (businessEMI / fullIncome) * 100
  const fullEmiPct       = (totalEMI / fullIncome) * 100

  // Remaining after EMI (can be negative = deficit)
  const bizAfterEMI      = rawFullIncome - businessEMI
  const fullAfterEMI     = rawFullIncome - totalEMI

  // Combined (for single-view when 100% business)
  const emiPct           = (totalEMI / fullIncome) * 100
  const netMonthly       = roi.totalMonthlyGain - roi.emiAmount

  // ── Other charges (component-level so hero and hisaab share same value) ──
  const _L                = inputs.loanAmount
  const _subtotalCharges  = (_L * 0.025) + (_L * 0.025) + 2500 + 2500 + (_L * 0.0025) + (_L * 0.01)
  const _gst              = _subtotalCharges * 0.18
  const _totalCharges     = _subtotalCharges + _gst
  const netAfterCharges   = roi.netGainTenure - _totalCharges

  // ── Exact calculation figures for each gain source ──
  const totalDiscPct  = (inputs.bulkDiscount ?? 0) + (inputs.schemeDiscount ?? 0) + (inputs.cashDiscount ?? 0)
  const cycles        = 365 / inputs.stockRotationDays
  const r = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

  const pf              = inputs.profitMargin / 100
  const bizLoanAmt      = inputs.loanAmount * bizPct / 100
  const normalMths      = 12 - inputs.seasonMonths
  const normalProfitYear = roi.normalSalesRise * pf * normalMths
  const seasonProfitYear = roi.seasonSalesRise * pf * inputs.seasonMonths

  const calcLines = {
    avgMonthlyProfit: [
      `Extra stock se bikri (30% realization):`,
      `(${r(bizLoanAmt)} × ${cycles.toFixed(1)} rotations/yr ÷ 12) × 30% = ${r(roi.normalSalesRise)}/mah extra sales`,
      ``,
      `Normal mahine (${normalMths}M):`,
      `${r(roi.normalSalesRise)} × ${inputs.profitMargin}% margin × ${normalMths}M = ${r(normalProfitYear)}/yr`,
      ``,
      `Season mahine (${inputs.seasonMonths}M, +${inputs.seasonUplift}% uplift):`,
      `${r(roi.normalSalesRise)} × ${(1 + inputs.seasonUplift/100).toFixed(2)} = ${r(roi.seasonSalesRise)}/mah`,
      `${r(roi.seasonSalesRise)} × ${inputs.profitMargin}% margin × ${inputs.seasonMonths}M = ${r(seasonProfitYear)}/yr`,
      ``,
      `Average (12 mahine mein):`,
      `(${r(normalProfitYear)} + ${r(seasonProfitYear)}) ÷ 12 = ${r(roi.avgMonthlyProfit)}/mah`,
    ].join('\n'),
    discountRecovered: (() => {
      const bulkStock = bizLoanAmt * 0.60
      return `${r(bizLoanAmt)} loan stock × 60% utilization = ${r(bulkStock)} bulk stock × ${totalDiscPct}% discount × ${cycles.toFixed(1)} rotations/yr ÷ 12 = ${r(roi.discountRecovered)}/mah`
    })(),
    competitorRecovered: (() => {
      const lost = Math.round((inputs.dailyWalkins ?? 0) * (inputs.lostCustomersPct ?? 0) / 100)
      return `${inputs.dailyWalkins} walkins × ${inputs.lostCustomersPct}% = ${lost} lost/din × ${r(inputs.avgBillValue)} × 30 days × ${inputs.profitMargin}% margin × 40% = ${r(roi.competitorRecovered)}/mah`
    })(),
    cashCycleGain: (() => {
      const existingProfit = inputs.monthlySales * pf
      return `Existing profit ${r(existingProfit)} × 7% efficiency = ${r(roi.cashCycleGain)}/mah`
    })(),
  }

  const segments = GAIN_SOURCES.map(s => ({
    ...s,
    val: roi[s.key] ?? 0,
    pct: roi.totalMonthlyGain > 0 ? ((roi[s.key] ?? 0) / roi.totalMonthlyGain) * 100 : 0,
  }))

  return (
    <ScreenShell
      title="Loan Se Kitna Faida 💚"
      subtitle="Dekhte hain loan lene ke baad kya hoga"
      step={screen}
      total={7}
      onBack={back}
      cta="Comparison Dekho →"
      ctaColor="green"
      onCta={next}
    >

      {/* ── Loan config card ── */}
      <LoanCustomizeCard />

      {/* ── Hero gain card ── */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-800 rounded-3xl p-5 mb-4 text-white shadow-lg">
        <p className="text-xs font-bold text-green-200 uppercase tracking-widest mb-2">
          {inputs.tenureMonths} Mahine Mein Net Faida
        </p>
        <p className="text-6xl font-extrabold leading-none mb-1">{fmtINR(netAfterCharges)}</p>
        <p className="text-sm text-green-200 font-medium">byaaj, EMI aur charges sab kaatke — sirf aapka profit</p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-white/15 rounded-xl p-2.5 text-center">
            <p className="text-xs text-green-200 font-semibold mb-0.5">Monthly gain</p>
            <p className="text-base font-extrabold">+{fmtINR(roi.totalMonthlyGain)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5 text-center">
            <p className="text-xs text-green-200 font-semibold mb-0.5">Payback</p>
            <p className="text-base font-extrabold">{roi.paybackMonths.toFixed(0)} mah</p>
          </div>
        </div>
      </div>

      {/* ── Per-source breakdown ── */}
      <div className="mb-4">
        <p className="text-sm font-bold text-slate-700 mb-2 px-1">Faida Kahan Se Ho Raha Hai?</p>
        {/* Stacked bar */}
        <div className="flex rounded-lg overflow-hidden h-3 mb-3 gap-px">
          {segments.map(s => (
            <div key={s.key} style={{ width: `${s.pct}%`, background: s.bar }} title={`${s.label}: ${Math.round(s.pct)}%`} />
          ))}
        </div>
        <div className="space-y-2">
          {segments.map(s => (
            <div key={s.key} className="rounded-xl border flex items-center gap-3 px-3 py-2.5"
              style={{ borderColor: s.bar + '40', background: s.bg }}>
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: s.bar }} />
              <span className="text-xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight" style={{ color: s.color }}>{s.label}</p>
                <p className="text-xs text-slate-400 leading-snug">{s.sub}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-extrabold" style={{ color: s.color }}>+₹{Math.round(s.val).toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400">{Math.round(s.pct)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EMI vs Gain summary ── */}
      <div className="rounded-2xl overflow-hidden mb-4 border border-slate-100 shadow-sm">

        {/* Total Faida — green header */}
        <div className="bg-emerald-600 px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Total Faida / Mahine</p>
            <p className="text-xs text-emerald-200 mt-0.5">Loan lagane ke baad extra kamaai</p>
          </div>
          <p className="text-2xl font-extrabold text-white">+₹{Math.round(roi.totalMonthlyGain).toLocaleString('en-IN')}</p>
        </div>

        {persPct > 0 ? (
          /* Split view */
          <div className="bg-white">
            {/* Business EMI */}
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <p className="text-sm font-semibold text-slate-700">🏢 Business EMI</p>
              <p className="text-base font-extrabold text-red-500">−₹{Math.round(businessEMI).toLocaleString('en-IN')}</p>
            </div>

            {/* Business Net — subtle highlight */}
            <div className="px-4 py-3 border-b border-slate-100 bg-emerald-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-emerald-800">💼 Business Net</p>
                <p className="text-xs text-emerald-500">Faida − Business EMI</p>
              </div>
              <p className="text-lg font-extrabold text-emerald-700">₹{Math.round(roi.totalMonthlyGain - businessEMI).toLocaleString('en-IN')}</p>
            </div>

            {/* Personal EMI */}
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <p className="text-sm font-semibold text-slate-700">🏠 Personal EMI</p>
              <p className="text-base font-extrabold text-red-400">−₹{Math.round(personalEMI).toLocaleString('en-IN')}</p>
            </div>

            {/* Net Pocket — strong finish */}
            <div className="px-4 py-4 bg-gradient-to-r from-emerald-700 to-green-600 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Net — Pocket Mein</p>
                <p className="text-xs text-emerald-200 mt-0.5">Sab kaatke haath mein aata hai</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-white">₹{Math.round(netMonthly).toLocaleString('en-IN')}</p>
                <p className="text-xs text-emerald-200">{fmtINR(netMonthly)} / mah</p>
              </div>
            </div>
          </div>
        ) : (
          /* Single view */
          <div className="bg-white">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-slate-700">📋 EMI <span className="text-xs text-slate-400 font-normal">(roz ₹{Math.round(roi.dailyEMI).toLocaleString('en-IN')})</span></p>
                {inputs.existingLoan && (inputs.existingEMI ?? 0) > 0 && (
                  <p className="text-xs text-slate-400">Loan EMI ₹{Math.round(roi.emiAmount).toLocaleString('en-IN')} + Purana ₹{Math.round(inputs.existingEMI ?? 0).toLocaleString('en-IN')}</p>
                )}
              </div>
              <p className="text-base font-extrabold text-red-500">−₹{Math.round(totalEMI).toLocaleString('en-IN')}</p>
            </div>
            <div className="px-4 py-4 bg-gradient-to-r from-emerald-700 to-green-600 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Net — Pocket Mein</p>
                <p className="text-xs text-emerald-200 mt-0.5">Sab kaatke haath mein aata hai</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-white">₹{Math.round(netMonthly).toLocaleString('en-IN')}</p>
                <p className="text-xs text-emerald-200">{fmtINR(netMonthly)} / mah</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── EMI affordability ── */}
      {persPct === 0 ? (
        /* ── Single view (100% business) ── */
        <div className={`rounded-2xl p-3 mb-4 border ${bizEmiPct < 30 ? 'bg-green-50 border-green-200' : bizEmiPct < 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{bizEmiPct < 30 ? '✅' : bizEmiPct < 50 ? '⚠️' : '🔴'}</span>
            <p className={`text-sm font-bold ${bizEmiPct < 30 ? 'text-green-800' : bizEmiPct < 50 ? 'text-amber-800' : 'text-red-800'}`}>
              EMI {Math.round(bizEmiPct)}% of net kamaai {bizEmiPct < 30 ? '— manageable!' : bizEmiPct < 50 ? '— thoda tight' : '— loan kam karo'}
            </p>
          </div>
          <p className={`text-xs mb-2 ${bizEmiPct < 30 ? 'text-green-600' : bizEmiPct < 50 ? 'text-amber-600' : 'text-red-600'}`}>
            Net kamaai: {fmtINR(grossMargin)} − {fmtINR(totalFixedExp)} = {fmtINR(netBizKamaai)} &nbsp;|&nbsp; EMI: {fmtINR(totalEMI)}/mah
          </p>
          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(bizEmiPct, 100)}%`, background: bizEmiPct < 30 ? '#16A34A' : bizEmiPct < 50 ? '#D97706' : '#DC2626' }} />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className={bizEmiPct < 30 ? 'text-green-600' : bizEmiPct < 50 ? 'text-amber-600' : 'text-red-600'}>{Math.round(bizEmiPct)}% of net kamaai</span>
            <span className="text-slate-400">Ideal &lt; 30%</span>
          </div>
        </div>
      ) : (
        /* ── Split view (business + personal) ── */
        <div className="rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">EMI Affordability — Business + Personal</p>
          </div>

          {/* ── Calculation breakdown ── */}
          {(() => {
            const r = n => '₹' + Math.round(n).toLocaleString('en-IN')
            const existingEMI = inputs.existingLoan ? (inputs.existingEMI ?? 0) : 0
            const totalNewEMI = businessEMI + personalEMI           // = roi.emiAmount
            const grandTotalEMI = totalNewEMI + existingEMI
            const afterAll = rawFullIncome - grandTotalEMI

            const rows = [
              { label: 'Business income',     value: grossMargin,       color: 'text-slate-700' },
              { label: '− Fixed expenses',    value: -totalFixedExp,    color: 'text-red-500'   },
              { label: '= Net biz income',    value: rawNetBizKamaai,   color: rawNetBizKamaai < 0 ? 'text-red-600 font-bold' : 'text-slate-800 font-bold', divider: true },
              ...(familyInc > 0 ? [{ label: '+ Parivar income', value: familyInc, color: 'text-slate-700' }] : []),
              { label: '− Business EMI',      value: -businessEMI,      color: 'text-red-500'   },
              { label: '− Personal EMI',      value: -personalEMI,      color: 'text-red-500'   },
              ...(existingEMI > 0 ? [{ label: '− Purana EMI',   value: -existingEMI, color: 'text-red-500' }] : []),
            ]

            return (
              <div className="px-4 py-3 border-b border-slate-100 space-y-1.5">
                {rows.map((row, i) => (
                  <div key={i}>
                    {row.divider && <div className="h-px bg-slate-200 my-1" />}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{row.label}</span>
                      <span className={`text-xs font-semibold ${row.color}`}>
                        {row.value < 0 ? `−${r(Math.abs(row.value))}` : r(row.value)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="h-px bg-slate-300 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Bacha / Mahine</span>
                  <span className={`text-base font-extrabold ${afterAll < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {afterAll < 0 ? `−${r(Math.abs(afterAll))}` : r(afterAll)}
                    {afterAll < 0 ? ' ⚠️' : ''}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* ── Affordability bars ── */}
          {/* Business EMI burden */}
          <div className={`px-4 py-3 border-b border-slate-100 ${bizEmiPct < 30 ? 'bg-green-50' : bizEmiPct < 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{bizEmiPct < 30 ? '✅' : bizEmiPct < 50 ? '⚠️' : '🔴'}</span>
                <p className={`text-xs font-bold ${bizEmiPct < 30 ? 'text-green-800' : bizEmiPct < 50 ? 'text-amber-800' : 'text-red-800'}`}>Business EMI — {Math.round(bizEmiPct)}% of income</p>
              </div>
              <span className="text-slate-400 text-xs">Ideal &lt;30%</span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(bizEmiPct, 100)}%`, background: bizEmiPct < 30 ? '#16A34A' : bizEmiPct < 50 ? '#D97706' : '#DC2626' }} />
            </div>
          </div>

          {/* Total EMI burden */}
          <div className={`px-4 py-3 ${fullEmiPct < 30 ? 'bg-green-50' : fullEmiPct < 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{fullEmiPct < 30 ? '✅' : fullEmiPct < 50 ? '⚠️' : '🔴'}</span>
                <p className={`text-xs font-bold ${fullEmiPct < 30 ? 'text-green-800' : fullEmiPct < 50 ? 'text-amber-800' : 'text-red-800'}`}>Total EMI (Biz + Personal{inputs.existingLoan && (inputs.existingEMI ?? 0) > 0 ? ' + Purana' : ''}) — {Math.round(fullEmiPct)}% of income</p>
              </div>
              <span className="text-slate-400 text-xs">Ideal &lt;30%</span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(fullEmiPct, 100)}%`, background: fullEmiPct < 30 ? '#16A34A' : fullEmiPct < 50 ? '#D97706' : '#DC2626' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Loan cost breakdown ── */}
      {(() => {
        const L = inputs.loanAmount
        const processingFee   = L * 0.025
        const insurance       = L * 0.025
        const legal           = 2500
        const valuation       = 2500
        const stamping        = L * 0.0025
        const mortgage        = L * 0.01
        const subtotalCharges = _subtotalCharges
        const gst             = _gst
        const totalCharges    = _totalCharges
        const totalCostOfLoan = roi.totalInterest + totalCharges

        const chargeRows = [
          { label: 'Processing fees (2.5%)',   val: processingFee },
          { label: 'Insurance (2.5%)',          val: insurance },
          { label: 'Legal charges',             val: legal },
          { label: 'Valuation charges',         val: valuation },
          { label: 'Stamping (0.25%)',          val: stamping },
          { label: 'Registered mortgage (1%)',  val: mortgage },
        ]

        const flatRate = ((roi.totalInterest / L) / (inputs.tenureMonths / 12) * 100).toFixed(1)
        const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
            {/* Header */}
            <div className="bg-amber-600 px-4 py-3">
              <p className="text-xs font-bold text-amber-100 uppercase tracking-widest">💸 Loan Ka Poora Hisaab</p>
            </div>

            {/* Cost section */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Loan Ki Laagat</p>
              <div className="space-y-2">

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Loan liya</span>
                  <span className="text-sm font-bold text-slate-800">{fmt(L)}</span>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-600">Total byaaj</p>
                    <p className="text-xs text-slate-400">{inputs.interestRate}% reducing · ~{flatRate}% flat p.a.</p>
                  </div>
                  <span className="text-sm font-bold text-amber-700">{fmt(roi.totalInterest)}</span>
                </div>

                {/* Other charges collapsible */}
                <div className="rounded-xl border border-orange-200 overflow-hidden">
                  <button
                    onClick={() => setShowCharges(c => !c)}
                    className="w-full flex justify-between items-center px-3 py-2 bg-orange-50 text-orange-800"
                  >
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <span className="text-xs">{showCharges ? '▲' : '▼'}</span> Other Charges
                    </span>
                    <span className="text-sm font-extrabold">{fmt(totalCharges)}</span>
                  </button>
                  {showCharges && (
                    <div className="px-3 py-2 space-y-1.5 bg-white">
                      {chargeRows.map(row => (
                        <div key={row.label} className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">{row.label}</span>
                          <span className="text-xs font-semibold text-slate-700">{fmtINRFull(row.val)}</span>
                        </div>
                      ))}
                      <div className="h-px bg-slate-100 my-1" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Subtotal</span>
                        <span className="text-xs font-semibold text-slate-700">{fmtINRFull(subtotalCharges)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">GST (18%)</span>
                        <span className="text-xs font-semibold text-slate-700">{fmtINRFull(gst)}</span>
                      </div>
                      <div className="h-px bg-slate-100 my-1" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-orange-800">Total (incl. GST)</span>
                        <span className="text-xs font-extrabold text-orange-800">{fmtINRFull(totalCharges)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center bg-red-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-semibold text-red-700">Total cost (byaaj + charges)</span>
                  <span className="text-sm font-extrabold text-red-700">{fmt(totalCostOfLoan)}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 mx-4" />

            {/* Repayment section */}
            <div className="px-4 pt-2 pb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Repayment</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total EMI bharoge ({inputs.tenureMonths} mah)</span>
                <span className="text-sm font-extrabold text-slate-800">{fmt(roi.totalRepayment)}</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 mx-4" />

            {/* Gain vs cost */}
            <div className="px-4 pt-2 pb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Kamaai vs Laagat</p>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm text-slate-600">Extra kamaai ({inputs.tenureMonths} mah)</p>
                  {bizPct < 100 && (
                    <p className="text-xs text-slate-400">Business {bizPct}% hisse se calculate hua</p>
                  )}
                </div>
                <span className="text-sm font-extrabold text-green-700">+{fmt(roi.totalMonthlyGain * inputs.tenureMonths)}</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex justify-between items-center">
                <span className="text-sm font-extrabold text-green-800">Net Profit (sab kaatke)</span>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-green-700">{fmt(netAfterCharges)}</p>
                  <p className="text-xs text-green-500">{fmtINR(netAfterCharges)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Explain button ── */}
      <button
        onClick={() => setDrawer(true)}
        className="w-full py-3.5 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 bg-white flex items-center justify-center gap-2"
      >
        <span>🤔</span> Faida Kaise Calculate Hua? Samjhao
      </button>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Loan Se Faida Kaise?">
        <p className="mb-4 text-sm text-slate-600">
          Loan se jo paisa aata hai woh <strong>stock mein lagta hai</strong> — stock cycle se 4 jagah faida hota hai. Aapke numbers se:
        </p>
        <div className="space-y-3">
          {[
            {
              icon: '📦', head: 'Zyada maal → zyada bikri',
              body: 'Stock full hoga toh koi customer empty haath nahi jaayega — seedha revenue increase',
              calc: calcLines.avgMonthlyProfit,
              result: roi.avgMonthlyProfit,
            },
            {
              icon: '🏷️', head: 'Bulk discount',
              body: 'Zyada kharidoge toh supplier 5-10% discount deta hai — yeh seedha aapki pocket mein aata hai',
              calc: calcLines.discountRecovered,
              result: roi.discountRecovered,
            },
            {
              icon: '🏃', head: 'Competitor ka customer wapas',
              body: 'Jo pehle jaata tha, ab aapke paas rukega — permanent revenue recovery',
              calc: calcLines.competitorRecovered,
              result: roi.competitorRecovered,
            },
            {
              icon: '🔄', head: 'Cash flow smooth',
              body: 'Jab cash flow better hota hai, toh operations smooth hoti hain — 10% extra efficiency milti hai',
              calc: calcLines.cashCycleGain,
              result: roi.cashCycleGain,
            },
          ].map(item => (
            <ROIDrawerItem key={item.head} item={item} />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
            <p className="text-sm font-bold text-green-800">Total Monthly Faida</p>
            <div className="text-right">
              <p className="text-lg font-extrabold text-green-700">+{fmtINR(roi.totalMonthlyGain)}/mah</p>
              <p className="text-xs text-green-500">₹{Math.round(roi.totalMonthlyGain).toLocaleString('en-IN')}/mah</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-600">EMI (har mahine)</p>
            <div className="text-right">
              <p className="text-lg font-extrabold text-slate-600">−{fmtINR(roi.emiAmount)}/mah</p>
              <p className="text-xs text-slate-400">₹{Math.round(roi.emiAmount).toLocaleString('en-IN')}/mah</p>
            </div>
          </div>
          <div className="bg-green-100 border border-green-300 rounded-xl p-3 flex justify-between items-center">
            <p className="text-sm font-extrabold text-green-900">Net Pocket Mein</p>
            <div className="text-right">
              <p className="text-lg font-extrabold text-green-800">+{fmtINR(netMonthly)}/mah</p>
              <p className="text-xs text-green-600">₹{Math.round(netMonthly).toLocaleString('en-IN')}/mah</p>
            </div>
          </div>
        </div>
      </Drawer>
    </ScreenShell>
  )
}
