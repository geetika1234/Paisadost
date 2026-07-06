import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { signOut } from '../lib/auth'

export default function S_PendingApproval() {
  const { profile } = useApp()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try { await signOut() } catch (_) {}
    setLoading(false)
  }

  return (
    <div className="phone-shell flex flex-col bg-white" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0 border-b border-slate-100">
        <img
          src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png"
          alt="Ar Financier's"
          className="h-8 w-auto object-contain"
        />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-5">
          <span className="text-4xl">⏳</span>
        </div>

        <h2 className="text-xl font-extrabold text-slate-800 text-center mb-2">
          Approval Pending
        </h2>
        <p className="text-sm text-slate-500 text-center mb-1">
          Namaste, <strong className="text-slate-700">{profile?.name}</strong>!
        </p>
        <p className="text-sm text-slate-400 text-center leading-relaxed mb-8">
          Aapka account ban gaya. Admin approval milne ke baad app use kar sakte ho.
        </p>

        <div className="bg-white border border-brand-200 rounded-2xl px-5 py-4 w-full mb-8">
          <p className="text-xs font-bold text-brand-700 mb-1.5">Kya Karna Hai?</p>
          <div className="space-y-1">
            <p className="text-xs text-brand-600">• Apne manager ko batao ki aapne register kar liya</p>
            <p className="text-xs text-brand-600">• Woh Admin Panel se aapko approve karenge</p>
            <p className="text-xs text-brand-600">• Approve hone ke baad yeh page automatically update ho jayega</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          disabled={loading}
          className="text-sm font-semibold text-slate-400 active:text-slate-600 transition-colors"
        >
          {loading ? 'Logout ho raha hai...' : 'Logout'}
        </button>
      </div>
    </div>
  )
}
