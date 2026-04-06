import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import { calculateROI, calculateScore, fmtINR } from '../logic/calculations'

const POSITIVE_FACTORS = {
  age_good:    { label: 'Purana business — stable income' },
  age_great:   { label: 'Bahut purana business — trusted by customers' },
  margin_good: { label: 'Achhi margin — healthy business' },
  margin_great:{ label: 'Bahut achhi margin — strong profitability' },
  no_emi:      { label: 'Koi purani EMI nahi — full repayment capacity' },
  low_emi:     { label: 'Purani EMI manageable hai' },
  roi_good:    { label: 'Loan ka ROI bahut achha hai' },
  roi_great:   { label: 'ROI exceptional — loan clearly profitable' },
  problems:    { label: 'Clear business need — targeted use of loan' },
}

export default function S6_Intelligence() {
  const { inputs, next, back, screen } = useApp()
  const roi = calculateROI(inputs)
  const { score, band, flags } = calculateScore(inputs, roi)

  // Build positive factors list
  const positives = []
  if (inputs.businessAge === '5+')      positives.push(POSITIVE_FACTORS.age_great)
  else if (['2-5','1-2'].includes(inputs.businessAge)) positives.push(POSITIVE_FACTORS.age_good)
  if (inputs.profitMargin > 25)         positives.push(POSITIVE_FACTORS.margin_great)
  else if (inputs.profitMargin > 15)    positives.push(POSITIVE_FACTORS.margin_good)
  if (!inputs.existingLoan)             positives.push(POSITIVE_FACTORS.no_emi)
  else if (!flags.highEMI)              positives.push(POSITIVE_FACTORS.low_emi)
  if (roi.annualROIPct > 200)           positives.push(POSITIVE_FACTORS.roi_great)
  else if (roi.annualROIPct > 100)      positives.push(POSITIVE_FACTORS.roi_good)
  if (inputs.problems.length > 0)       positives.push(POSITIVE_FACTORS.problems)

  // Risk flags
  const risks = []
  if (flags.highEMI)         risks.push({ icon: '🔴', text: 'Purani EMI zyada hai — repayment capacity tight ho sakti hai' })
  if (flags.lowROI)          risks.push({ icon: '🟡', text: 'ROI thoda kam — loan amount review karo' })
  if (flags.cashFlowRisk)    risks.push({ icon: '🟡', text: 'Cash flow tight ho sakta hai payback period mein' })
  if (flags.thinMargin)      risks.push({ icon: '🔴', text: 'Margin bahut kam hai — business expenses cover ho paayenge?' })
  if (flags.udhariIncreasing)risks.push({ icon: '🔴', text: 'Udhari badh rahi hai — cash cycle tight ho sakta hai, collection improve karo' })

  // Strengths
  if (flags.strongGrowth) risks.unshift({ icon: '🟢', text: `ROI ${Math.round(roi.annualROIPct)}% — exceptional return on loan` })
  if (flags.quickPayback) risks.unshift({ icon: '🟢', text: `Loan ${roi.paybackMonths.toFixed(1)} mahine mein wapas — quick ROI` })

  // Agent note (internal, styled differently)
  let agentNote = ''
  if (score >= 80 && roi.annualROIPct > 150) {
    agentNote = `Strong profile. Upsell ₹${Math.min(Math.round(inputs.loanAmount * 1.5 / 25000) * 25000 / 100000, 21)}L offer try karo.`
  } else if (score >= 60) {
    agentNote = 'Good profile. Standard offer push karo — approval chances high hain.'
  } else if (flags.highEMI) {
    agentNote = 'Pehle waali EMI discuss karo — co-applicant suggest kar sakte ho.'
  } else {
    agentNote = 'Conservative offer se shuru karo. Profile review mein dega.'
  }

  // Score arc
  const arcAngle = (score / 100) * 251 // 251 = circumference of our circle approximation
  const circumference = 251

  return (
    <ScreenShell
      title="Aapka Business Score 🎯"
      subtitle="Yeh score aapki loan eligibility dikhata hai"
      step={screen}
      total={7}
      onBack={back}
      cta="Best Offer Dekho →"
      onCta={next}
    >
      {/* Score circle */}
      <div className="flex justify-center mb-6 mt-2">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="10" />
            {/* Score ring */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={band.color}
              strokeWidth="10"
              strokeDasharray={`${(score / 100) * 251.2} 251.2`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-5xl font-extrabold leading-none" style={{ color: band.color }}>{score}</p>
            <p className="text-sm font-bold mt-1" style={{ color: band.color }}>{band.emoji} {band.label}</p>
          </div>
        </div>
      </div>

      {/* Score band message */}
      <div
        className="rounded-2xl p-4 mb-4 text-center border"
        style={{ background: band.bg, borderColor: band.color + '40' }}
      >
        <p className="font-bold text-base" style={{ color: band.color }}>
          {score >= 80 && 'Aap ek bahut strong borrower hain! 🌟'}
          {score >= 60 && score < 80 && 'Aapka profile achha hai — loan easily milega ✅'}
          {score >= 40 && score < 60 && 'Kuch points improve ho sakte hain 🟡'}
          {score < 40 && 'Hum milke solution dhundh sakte hain ⚠️'}
        </p>
      </div>

      {/* Positive factors */}
      {positives.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <p className="text-sm font-bold text-green-800">✅ Kya Achha Hai Aapme</p>
          </div>
          {positives.map((p, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-50 last:border-0 flex items-start gap-3">
              <span className="text-green-500 font-bold">✓</span>
              <p className="text-sm text-slate-700">{p.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risk flags */}
      {risks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">⚑ Dhyan Rakhne Wali Baatein</p>
          </div>
          {risks.map((r, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-50 last:border-0 flex items-start gap-3">
              <span>{r.icon}</span>
              <p className="text-sm text-slate-700">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Agent-only note */}
      <div className="bg-indigo-900 rounded-2xl p-4 text-white mb-4">
        <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">
          🔒 Agent Note (Sirf Aapke Liye)
        </p>
        <p className="text-sm font-medium text-white">{agentNote}</p>
      </div>

      {/* Score breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">Score Ka Breakdown</p>
        </div>
        {[
          { label: 'Business ki umar', max: 20, val: { '<1':5,'1-2':10,'2-5':15,'5+':20 }[inputs.businessAge] ?? 10 },
          { label: 'Profit margin',    max: 20, val: inputs.profitMargin > 30 ? 20 : inputs.profitMargin > 20 ? 15 : inputs.profitMargin > 10 ? 10 : 5 },
          { label: 'EMI burden',       max: 20, val: flags.highEMI ? 0 : inputs.existingLoan ? 8 : 20 },
          { label: 'Loan ka ROI',      max: 20, val: roi.annualROIPct > 200 ? 20 : roi.annualROIPct > 100 ? 15 : roi.annualROIPct > 50 ? 10 : 5 },
          { label: 'Problem clarity',  max: 20, val: inputs.problems.length >= 3 ? 20 : inputs.problems.length >= 2 ? 15 : inputs.problems.length >= 1 ? 10 : 0 },
        ].map(row => (
          <div key={row.label} className="px-4 py-2.5 border-b border-slate-50 last:border-0">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-600">{row.label}</span>
              <span className="text-xs font-bold text-slate-800">{row.val}/{row.max}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(row.val / row.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  )
}
