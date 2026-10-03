import { useEffect } from 'react'

/**
 * Honest stand-in for sections that ship in later batches: says what is
 * coming and where to do the job today, instead of a fake empty table.
 */
export default function PlaceholderPage({ title, summary, coming, useMobileFor }) {
  useEffect(() => { document.title = `${title} · Admin · AR Financiers` }, [title])

  return (
    <section aria-labelledby="page-title" className="max-w-3xl">
      <h1 id="page-title" className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{summary}</p>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">Agle update mein</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc pl-5">
          {coming.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>

      {useMobileFor && (
        <p className="mt-4 text-sm text-slate-600">
          Abhi ke liye {useMobileFor}{' '}
          <a href="/" className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
            mobile Admin Panel
          </a>{' '}
          (Home → Admin Panel) mein karein.
        </p>
      )}
    </section>
  )
}
