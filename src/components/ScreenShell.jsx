/**
 * ScreenShell — wrapper for all screens
 * Provides: header, progress bar, scrollable body, sticky footer CTA
 */
export default function ScreenShell({ title, subtitle, step, total, onBack, children, cta, ctaDisabled, onCta, ctaColor = 'brand', secondaryCta, onSecondaryCta, secondaryCtaDisabled }) {
  const progress = ((step) / total) * 100

  const ctaBg = {
    brand: 'bg-brand',
    red:   'bg-loss',
    green: 'bg-gain',
  }[ctaColor] ?? 'bg-brand'

  return (
    <div className="phone-shell flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-brand text-white pt-12 pb-4 px-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <button onClick={onBack} className="text-white/70 text-xl leading-none">←</button>
          )}
          <div className="flex-1">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-widest">
              PaisaDost · Step {step + 1}/{total}
            </p>
            <h1 className="text-xl font-extrabold leading-tight mt-0.5">{title}</h1>
            {subtitle && <p className="text-sm text-indigo-200 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {/* Progress */}
        <div className="h-1.5 bg-indigo-900/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-36">
        {children}
      </div>

      {/* Footer CTA */}
      {cta && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-100 p-4 z-30 space-y-2">
          {secondaryCta && (
            <button
              onClick={onSecondaryCta}
              disabled={secondaryCtaDisabled}
              className="w-full py-3 rounded-2xl text-indigo-600 font-bold text-sm border-2 border-indigo-200 disabled:opacity-40 active:scale-95 transition-all"
            >
              {secondaryCta}
            </button>
          )}
          <button
            onClick={onCta}
            disabled={ctaDisabled}
            className={`w-full py-4 rounded-2xl text-white font-bold text-base tracking-wide ${ctaBg} disabled:opacity-40 active:scale-95 transition-all shadow-lg`}
          >
            {cta}
          </button>
        </div>
      )}
    </div>
  )
}
