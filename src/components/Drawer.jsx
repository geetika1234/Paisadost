/**
 * Drawer — bottom sheet for explanations
 */
export default function Drawer({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-slate-800 mb-3">{title}</h3>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl bg-slate-100 font-semibold text-slate-700"
        >
          Theek Hai, Samajh Gaya ✓
        </button>
      </div>
    </>
  )
}
