import { useState } from 'react'
import { signIn, signUp } from '../lib/auth'

export default function S_Auth() {
  const [tab,     setTab]     = useState('login')
  const [form,    setForm]    = useState({ mobile: '', name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function switchTab(t) { setTab(t); setError(null); setSuccess(null) }

  async function handleLogin() {
    if (!form.mobile.trim() || !form.password) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      await signIn({ mobile: form.mobile, password: form.password })
      // AppContext onAuthStateChange handles the rest
    } catch (err) {
      const msg = err.message
      setError(
        msg === 'Invalid login credentials'
          ? 'Mobile number ya password galat hai'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    const mobile = form.mobile.trim()
    const name   = form.name.trim()
    if (!mobile || !name || !form.password) return
    if (mobile.length !== 10) { setError('10 digit mobile number chahiye'); return }
    if (form.password.length < 6) { setError('Password kam se kam 6 characters ka hona chahiye'); return }
    if (form.password !== form.confirm) { setError('Passwords match nahi ho rahe'); return }
    setLoading(true); setError(null); setSuccess(null)
    try {
      await signUp({ mobile, name, password: form.password })
      setSuccess('Register ho gaye! Admin approval ka wait karein.')
      window.__arfinancierRefreshAuth?.()
    } catch (err) {
      const msg = err.message
      setError(
        msg.includes('already registered') || msg.includes('already been registered')
          ? 'Yeh mobile number pehle se registered hai — Login karein'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = tab === 'login'
    ? !!(form.mobile.trim() && form.password)
    : !!(form.mobile.trim() && form.name.trim() && form.password && form.confirm)

  return (
    <div className="phone-shell flex flex-col bg-slate-50" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-16 pb-10 px-6 flex-shrink-0 flex flex-col items-center">
        <img
          src="https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png"
          alt="Ar Financier's"
          className="h-10 w-auto object-contain mb-3"
        />
        <h1 className="text-2xl font-extrabold">Ar Financier's</h1>
        <p className="text-indigo-300 text-sm mt-1">Field Sales Platform</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-slate-200 flex-shrink-0">
        {[['login', 'Login'], ['register', 'Register']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all
              ${tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3">

        {tab === 'register' && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aapka Naam</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Pura naam likho"
              autoComplete="name"
              className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
            />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile Number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.mobile}
            onChange={e => set('mobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="10 digit number"
            autoComplete="tel"
            className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="••••••••"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            onKeyDown={e => tab === 'login' && e.key === 'Enter' && canSubmit && handleLogin()}
            className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
          />
        </div>

        {tab === 'register' && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password Confirm Karein</label>
            <input
              type="password"
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-600">⚠️ {error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-green-700">✅ {success}</p>
          </div>
        )}

        {tab === 'register' && !success && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700">
              ℹ️ Register karne ke baad Admin approval milne ka wait karna hoga.
            </p>
          </div>
        )}

        <button
          onClick={tab === 'login' ? handleLogin : handleRegister}
          disabled={loading || !canSubmit}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-indigo-200 text-base"
        >
          {loading
            ? (tab === 'login' ? 'Login ho raha hai...' : 'Register ho raha hai...')
            : (tab === 'login' ? 'Login Karein →' : 'Register Karein →')}
        </button>

      </div>
    </div>
  )
}
