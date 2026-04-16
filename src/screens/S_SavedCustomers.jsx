import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getAllLoans, deleteLoan } from '../lib/db/loans'
import { fmtINR } from '../logic/calculations'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function S_SavedCustomers() {
  const { closeSavedCustomers, loadCustomer } = useApp()
  const [customers,       setCustomers]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting,        setDeleting]        = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getAllLoans()
        setCustomers(data)
      } catch (err) {
        setError(err.message || 'Data load karne mein error aayi.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleLoad(record) {
    loadCustomer(record.inputs)
    closeSavedCustomers()
  }

  async function handleDelete(id) {
    setDeleting(true)
    try {
      await deleteLoan(id)
      setCustomers(prev => prev.filter(c => c.id !== id))
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err.message || 'Delete karne mein error aayi.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-3 px-5 flex-shrink-0 flex items-center justify-between">
        <div>
          <img src="https://rzktrracmsxiwhryfxrw.supabase.co/storage/v1/object/public/photos/LOGO.png" alt="PaisaDost" className="h-6 w-auto object-contain mb-1" />
          <h1 className="text-lg font-extrabold leading-tight">Saved Customers</h1>
          <p className="text-xs text-indigo-300 mt-0.5">{customers.length} customer{customers.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button
          onClick={closeSavedCustomers}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-400">Load ho raha hai...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-sm font-bold text-slate-600">Abhi koi saved customer nahi hai</p>
            <p className="text-xs text-slate-400 mt-1">Customer Ki Details mein jaake Save Karen dabao</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map(record => (
              <div key={record.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Customer info */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-slate-800 truncate">
                        {record.customerName || 'Naam nahi diya'}
                      </p>
                      {record.customerMobile && (
                        <p className="text-xs text-slate-500">📞 {record.customerMobile}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-indigo-600">{fmtINR(record.inputs.loanAmount)}</p>
                      <p className="text-xs text-slate-400">{record.inputs.tenureMonths}M loan</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {record.inputs.businessType && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold capitalize">
                        {record.inputs.businessType}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(record.savedAt)}</span>
                  </div>
                </div>

                {/* Actions or confirm delete */}
                {confirmDeleteId === record.id ? (
                  <div className="px-4 pb-3 flex gap-2">
                    <button
                      onClick={() => handleDelete(record.id)}
                      disabled={deleting}
                      className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-60"
                    >
                      {deleting ? 'Deleting...' : 'Haan, Delete Karo'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex border-t border-slate-100">
                    <button
                      onClick={() => handleLoad(record)}
                      className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold text-center active:scale-95 transition-all"
                    >
                      📂 Load Karen
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(record.id)}
                      className="px-4 py-2.5 text-red-400 text-xs font-bold border-l border-slate-100 active:scale-95 transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
