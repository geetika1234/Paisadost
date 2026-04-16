import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { saveCustomer } from '../lib/db/customers'
import { addEvent } from '../lib/db/events'
import { getCurrentUser } from '../lib/db/dashboard'

export default function S_QuickCreate() {
  const { closeQuickCreate, activateCustomer } = useApp()

  const [form, setForm] = useState({ shopName: '', city: '', area: '', ownerName: '', mobile: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const canSave = form.shopName.trim() && form.city.trim()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const salesman = getCurrentUser()
      const customer = await saveCustomer({
        name:       form.ownerName || form.shopName,
        shop_name:  form.shopName.trim(),
        owner_name: form.ownerName.trim() || null,
        mobile:     form.mobile.trim()    || null,
        area:       form.city.trim(),
        landmark:   form.area.trim()      || null,
        stage:      'visited',
      })
      const cid = customer.customer_id
      // Create a visit_done event so this lead appears in the dashboard
      const visitEvent = await addEvent(cid, 'visit_done', {
        shopName:  customer.shop_name,
        ownerName: customer.owner_name || '',
        mobile:    customer.mobile     || '',
        city:      customer.area       || '',
        market:    customer.landmark   || '',
      }, salesman)
      activateCustomer({
        id:           cid,
        visitEventId: visitEvent.event_id,   // used to update same event later
        shopName:     customer.shop_name,
        ownerName:    customer.owner_name || '',
        mobile:       customer.mobile     || '',
        city:         customer.area       || '',
        market:       customer.landmark   || '',
        stage:        'visited',
      })
      closeQuickCreate()
    } catch (err) {
      setError(err.message || 'Customer banana mein error aayi.')
    } finally {
      setSaving(false)
    }
  }

  const salesmanName = getCurrentUser()

  const FIELDS = [
    { key: 'shopName',  label: '🏪 दुकान का नाम',     placeholder: 'Ram Kirana Store',  required: true,  textOnly: true  },
    { key: 'city',      label: '📍 शहर / गांव',         placeholder: 'जैसे: Jaipur',      required: true,  textOnly: true  },
    { key: 'area',      label: '🏬 मार्केट / एरिया',    placeholder: 'जैसे: Johri Bazar', required: false, textOnly: true  },
    { key: 'ownerName', label: '👤 मालिक का नाम',       placeholder: 'Ram Lal Gupta',     required: false, textOnly: true  },
    { key: 'mobile',    label: '📞 मोबाइल',             placeholder: '9876543210',         required: false, numOnly: true   },
  ]

  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-5 px-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <img src="https://rzktrracmsxiwhryfxrw.supabase.co/storage/v1/object/public/photos/LOGO.png" alt="PaisaDost" className="h-6 w-auto object-contain mb-1" />
            <h1 className="text-xl font-extrabold leading-tight mt-0.5">🏪 Nayi Lead Banao</h1>
            {salesmanName && <p className="text-xs text-indigo-300 mt-0.5">👤 {salesmanName}</p>}
          </div>
          <button
            onClick={closeQuickCreate}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-32 space-y-3">

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-indigo-700">
            ℹ️ Customer ka record turant banta hai — baaki details baad mein bhar sakte hain
          </p>
        </div>

        {FIELDS.map(f => {
          const isEmpty = f.required && !form[f.key].trim()
          return (
            <div key={f.key} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {f.label}{f.required ? ' *' : ' (optional)'}
              </label>
              <input
                type={f.numOnly ? 'tel' : 'text'}
                inputMode={f.numOnly ? 'numeric' : 'text'}
                maxLength={f.numOnly ? 10 : undefined}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => {
                  let v = e.target.value
                  if (f.textOnly) v = v.replace(/[0-9]/g, '')
                  if (f.numOnly)  v = v.replace(/[^0-9]/g, '').slice(0, 10)
                  set(f.key, v)
                }}
                className="w-full mt-1 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300"
              />
            </div>
          )
        })}

        {error && (
          <p className="text-xs text-red-500 font-semibold px-1">⚠️ {error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-200 px-4 py-4 z-30">
        {!canSave && (
          <p className="text-xs text-amber-600 font-semibold text-center mb-2">
            * दुकान का नाम और शहर ज़रूरी है
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={closeQuickCreate}
            className="flex-1 py-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || saving}
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-indigo-200"
          >
            {saving ? 'Ban Raha Hai...' : '✅ Lead Banao →'}
          </button>
        </div>
      </div>
    </div>
  )
}
