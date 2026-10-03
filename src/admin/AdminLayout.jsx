import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { signOut } from '../lib/auth'

const LOGO_URL = 'https://iqibabyksgjdbnrfjeog.supabase.co/storage/v1/object/public/photos/LOGO.png'

export const NAV_ITEMS = [
  { to: '/',           label: 'Today',      end: true },
  { to: '/leads',      label: 'Leads' },
  { to: '/followups',  label: 'Follow-ups' },
  { to: '/team',       label: 'Team' },
  { to: '/loans',      label: 'Loans' },
]

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager' }

export default function AdminLayout({ children }) {
  const { profile } = useApp()

  async function handleSignOut() {
    try { await signOut() } finally { window.location.assign('/') }
  }

  return (
    <div className="admin-shell min-h-screen flex">
      <a href="#admin-main" className="admin-skip-link">Skip to content</a>

      <nav
        aria-label="Admin sections"
        className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen"
      >
        <div className="px-5 pt-5 pb-6">
          <img src={LOGO_URL} alt="AR Financiers" className="h-6 w-auto object-contain" />
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin</p>
        </div>

        <ul className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="px-5 py-4 border-t border-slate-200">
          <p className="text-sm font-semibold text-slate-800 truncate">{profile?.fullname}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[profile?.role] || profile?.role}</p>
          <div className="mt-3 flex gap-3 text-xs font-semibold">
            <a href="/" className="text-brand-600 hover:text-brand-700">Mobile app</a>
            <button type="button" onClick={handleSignOut} className="text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Below 1024px the console is cramped; say so instead of silently breaking. */}
        <div role="note" className="lg:hidden bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs font-medium text-amber-800">
          Admin desktop screen ke liye bana hai. Phone par approvals ke liye{' '}
          <a href="/" className="underline">mobile Admin Panel</a> use karein.
        </div>
        <main id="admin-main" tabIndex={-1} className="flex-1 px-8 py-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
