import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import BigNumber from '../components/BigNumber'
import { calculateROI, calculateRecommendation, fmtINR, fmtINRFull } from '../logic/calculations'

const BUSINESS_LABELS = {
  kirana: 'Kirana Store', kapda: 'Kapda / Textile', pharma: 'Medical / Pharma',
  hardware: 'Hardware', dairy: 'Dairy / Bakery', auto: 'Auto Parts',
  salon: 'Salon / Beauty', other: 'Business',
}

export default function S7_Offer() {
  const { inputs, back, screen } = useApp()
  const [shared, setShared] = useState(false)
  const [reset, setReset] = useState(false)

  const roi = calculateROI(inputs)
  const rec = calculateRecommendation(inputs, roi)

  const businessLabel = BUSINESS_LABELS[inputs.businessType] ?? 'Business'

  function handleShare() {
    const text = `Namaste! 🙏\n\nAapke ${businessLabel} ke liye hamaara PaisaDost analysis:\n\n` +
      `✅ Recommended Loan: ${fmtINRFull(rec.recLoan)}\n` +
      `✅ Monthly EMI: ${fmtINRFull(Math.round(rec.recEMI))}\n` +
      `✅ Tenure: ${rec.recTenure} mahine\n` +
      `✅ Monthly Extra Kamaai: ${fmtINRFull(Math.round(roi.totalMonthlyGain))}\n` +
      `✅ Net Faida (${rec.recTenure}M mein): ${fmtINRFull(Math.round(rec.recNetGain))}\n` +
      `✅ Payback: ${roi.paybackMonths.toFixed(1)} mahine mein\n\n` +
      `Aage badhne ke liye call karein! 📞\n\n— PaisaDost`

    if (navigator.share) {
      navigator.share({ text })
        .then(() => setShared(true))
        .catch(() => {})
    } else {
      navigator.clipboard?.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 3000)
    }
  }

  // Timeline visual
  const milestones = [
    { month: 0,  label: 'Loan Mila', icon: '🎉', color: '#4338CA' },
    { month: Math.ceil(roi.paybackMonths), label: 'Loan Wapas', icon: '💯', color: '#16A34A' },
    { month: rec.recTenure, label: 'Pure Faida', icon: '💰', color: '#D97706' },
  ]

  return (
    <ScreenShell
      title="Aapka Best Offer 💰"
      subtitle="Yeh loan specially aapke business ke liye hai"
      step={screen}
      total={7}
      onBack={back}
      cta={shared ? '✅ Share Ho Gaya!' : '📲 WhatsApp Pe Bhejo'}
      ctaColor={shared ? 'green' : 'brand'}
      onCta={handleShare}
    >
      {/* Offer card */}
      <div className="bg-gradient-to-br from-brand to-indigo-700 rounded-3xl p-5 text-white mb-5 shadow-xl">
        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-3">
          🎯 Recommended Offer — {businessLabel}
        </p>

        <div className="mb-4">
          <p className="text-sm text-indigo-200">Loan Amount</p>
          <p className="text-5xl font-extrabold">{fmtINR(rec.recLoan)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-2xl p-3">
            <p className="text-xs text-indigo-200 mb-1">Monthly EMI</p>
            <p className="text-2xl font-extrabold">{fmtINR(rec.recEMI)}</p>
            <p className="text-xs text-indigo-300">= {fmtINR(rec.recEMI / 30)}/din</p>
          </div>
          <div className="bg-white/15 rounded-2xl p-3">
            <p className="text-xs text-indigo-200 mb-1">Tenure</p>
            <p className="text-2xl font-extrabold">{rec.recTenure} mah</p>
            <p className="text-xs text-indigo-300">@ {inputs.interestRate}% yearly</p>
          </div>
        </div>
      </div>

      {/* Return numbers */}
      <BigNumber
        label={`${rec.recTenure} Mahine Mein Net Faida`}
        value={fmtINR(rec.recNetGain)}
        sub="Byaaj aur EMI sab kaatke — sirf aapka profit"
        color="green"
        size="lg"
        animate
      />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Har Mahine Extra</p>
          <p className="text-2xl font-extrabold text-green-600">{fmtINR(roi.totalMonthlyGain)}</p>
          <p className="text-xs text-green-500 font-medium">kamaai badhegi</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Loan Wapas</p>
          <p className="text-2xl font-extrabold text-brand">{roi.paybackMonths.toFixed(0)} mah</p>
          <p className="text-xs text-brand font-medium">mein seedha</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
        <p className="text-sm font-bold text-slate-700 mb-4">📅 Aapka Loan Journey</p>
        <div className="relative">
          {/* Line */}
          <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-slate-200" />
          {milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-4 mb-4 last:mb-0 relative">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 z-10 border-2 border-white shadow"
                style={{ background: m.color }}
              >
                {m.icon}
              </div>
              <div className="pt-1.5">
                <p className="text-sm font-bold text-slate-800">
                  {m.month === 0 ? 'Aaj' : `Mahina ${m.month}`}
                </p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why this amount */}
      <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 mb-5">
        <p className="text-sm font-bold text-brand mb-2">🤔 Yeh Amount Kyun?</p>
        <ul className="space-y-1.5">
          <li className="text-xs text-slate-600">
            ✓ Aapki monthly bikri ka 3× = {fmtINR(inputs.monthlySales * 3)} tak mil sakta tha
          </li>
          <li className="text-xs text-slate-600">
            ✓ Repayment capacity ke hisaab se = {fmtINR(inputs.monthlySales * inputs.profitMargin / 100 * 18)} tak
          </li>
          <li className="text-xs text-slate-600">
            ✓ Aapne {fmtINR(inputs.loanAmount)} maanga
          </li>
          <li className="text-xs font-semibold text-brand mt-2">
            → Best fit: {fmtINR(rec.recLoan)} (comfortable + profitable)
          </li>
        </ul>
      </div>

      {/* Apply CTA area */}
      <div className="bg-green-50 rounded-2xl p-4 border border-green-200 mb-20">
        <p className="text-base font-bold text-green-800 mb-1">Ready to Apply?</p>
        <p className="text-sm text-green-700">
          Pehle yeh summary customer ke WhatsApp pe bhejo — phir documents le lo.
        </p>
      </div>
    </ScreenShell>
  )
}
