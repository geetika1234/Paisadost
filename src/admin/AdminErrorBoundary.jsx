import { Component } from 'react'

/**
 * Catches a failed lazy-load of the admin bundle (e.g. a deploy replaced the
 * chunk while the tab was open) and any render error inside the console, so
 * the admin gets a way out instead of a blank page.
 */
export default class AdminErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[admin] render failed', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-800">Admin page load nahi hua</h1>
          <p className="mt-2 text-sm text-slate-600">
            App ka naya version aaya ho sakta hai. Page reload karein.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
            >
              Reload
            </button>
            <a href="/" className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white">
              Mobile app
            </a>
          </div>
        </div>
      </div>
    )
  }
}
