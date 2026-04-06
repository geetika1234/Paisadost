import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import { calculateCOD, calculateROI, fmtINR } from '../logic/calculations'

export default function S5_Comparison() {
  const { inputs, next, back, screen } = useApp()

  const cod = calculateCOD(inputs)
  const roi = calculateROI(inputs)

  const n = inputs.tenureMonths  // same period for both sides

  // Loss over same tenure period (apples-to-apples)
  const lossOverTenure  = cod.monthlyCoD * n
  // Gain over same tenure period (already tenure-based)
  const gainOverTenure  = roi.netGainTenure
  // Total swing = what you miss by NOT taking the loan
  const totalSwing      = lossOverTenure + gainOverTenure

  const monthlyNetGain  = roi.totalMonthlyGain - roi.emiAmount
  const emiPct          = Math.round((roi.emiAmount / (inputs.monthlySales * inputs.profitMargin / 100)) * 100)

  // Dynamic insight
  let insight = ''
  if (roi.annualROIPct > 200) {
    insight = `💡 Har ₹1 byaaj pe ₹${(roi.annualROIPct / 100).toFixed(1)} kamaai — bahut strong deal!`
  } else if (roi.paybackMonths < 8) {
    insight = `💡 Loan sirf ${roi.paybackMonths.toFixed(0)} mahine mein wapas ho jaayega!`
  } else if (emiPct < 25) {
    insight = `💡 EMI aapki kamaai ka sirf ${emiPct}% — bilkul manageable!`
  } else {
    insight = `💡 Net monthly gain: ${fmtINR(monthlyNetGain)} — EMI ke baad bhi`
  }

  return (
    <ScreenShell
      title="Fark Dekho 👀"
      subtitle="Dono ${n} mahine ke liye compare kar rahe hain — same period"
      step={screen}
      total={7}
      onBack={back}
      cta="Score + Best Offer Dekho →"
      onCta={next}
    >
      {/* Period label — makes the apples-to-apples clear */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
        <span className="text-base">📅</span>
        <p className="text-sm font-semibold text-brand">
          Dono side <span className="underline">{n} mahine</span> ke liye dikha rahe hain — fair comparison
        </p>
      </div>

      {/* Without loan */}
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">❌</span>
          <div>
            <p className="text-base font-bold text-red-800">Agar Loan NAHI Liya</p>
            <p className="text-xs text-red-400 font-medium">{n} mahine mein</p>
          </div>
        </div>
        <p className="text-4xl font-extrabold text-red-700">{fmtINR(lossOverTenure)}</p>
        <p className="text-sm text-red-600 font-medium mt-1">ka nuksaan hota rahega</p>
        <div className="mt-3 pt-3 border-t border-red-200 space-y-1">
          <p className="text-xs text-red-500">= {fmtINR(cod.monthlyCoD)}/mahine ka nuksaan</p>
          <p className="text-xs text-red-500">= {fmtINR(cod.annualCoD)}/saal ka nuksaan</p>
        </div>
      </div>

      {/* With loan */}
      <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-base font-bold text-green-800">Agar Loan LIYA</p>
            <p className="text-xs text-green-500 font-medium">{n} mahine mein</p>
          </div>
        </div>
        <p className="text-4xl font-extrabold text-green-700">{fmtINR(gainOverTenure)}</p>
        <p className="text-sm text-green-600 font-medium mt-1">ka faida — byaaj kaatke bhi</p>
        <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
          <p className="text-xs text-green-600">= {fmtINR(roi.totalMonthlyGain)}/mahine gross kamaai</p>
          <p className="text-xs text-green-600">= {fmtINR(monthlyNetGain)}/mahine net (EMI kaatke)</p>
        </div>
      </div>

      {/* Total swing */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 mb-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">
          {n} Mahine Ka Total Fark
        </p>
        <p className="text-5xl font-extrabold text-amber-800">{fmtINR(totalSwing)}</p>
        <p className="text-sm text-amber-700 font-medium mt-1">
          loan lene aur na lene ke beech ka fark
        </p>
        <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-amber-600 font-medium">Nuksaan bachaya</p>
            <p className="font-bold text-amber-800">{fmtINR(lossOverTenure)}</p>
          </div>
          <div>
            <p className="text-amber-600 font-medium">Extra kamaai ki</p>
            <p className="font-bold text-amber-800">{fmtINR(gainOverTenure)}</p>
          </div>
        </div>
      </div>

      {/* EMI anchor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex items-center gap-4">
        <div className="text-center bg-brand/10 rounded-xl p-3 flex-shrink-0">
          <p className="text-2xl font-extrabold text-brand">{fmtINR(roi.dailyEMI)}</p>
          <p className="text-xs font-bold text-brand/70">ROZ KI EMI</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">Roz ka kharch — chai se bhi kam!</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Mahine ki EMI {fmtINR(roi.emiAmount)} ÷ 30 = {fmtINR(roi.dailyEMI)}/din
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Return: {fmtINR(roi.totalMonthlyGain)}/mahine extra kamaai
          </p>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
        <p className="text-sm font-semibold text-brand">{insight}</p>
      </div>
    </ScreenShell>
  )
}
