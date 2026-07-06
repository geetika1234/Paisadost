/**
 * ScreenShell — wrapper for all screens
 * Provides: header, progress bar, scrollable body, sticky footer CTA
 */
export default function ScreenShell({ title, subtitle, step, total, onBack, children, cta, ctaDisabled, onCta, ctaColor = 'brand', secondaryCta, onSecondaryCta, secondaryCtaDisabled }) {
  const progress = ((step) / total) * 100

  const ctaBg = {
    brand: 'bg-accent-400',
    red:   'bg-loss',
    green: 'bg-gain',
  }[ctaColor] ?? 'bg-accent-400'

  return (
    <div className="phone-shell flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-white pt-12 pb-4 px-5 flex-shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <button onClick={onBack} className="text-slate-400 text-xl leading-none">←</button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <img
                src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png"
                alt="Ar Financier's"
                className="h-5 w-auto object-contain"
              />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">· Step {step + 1}/{total}</span>
            </div>
            <h1 className="text-xl font-extrabold leading-tight mt-0.5 text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {/* Progress */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500"
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
              className="w-full py-3 rounded-2xl text-brand-600 font-bold text-sm border-2 border-brand-200 disabled:opacity-40 active:scale-95 transition-all"
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
