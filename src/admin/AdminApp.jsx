import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import PlaceholderPage from './pages/PlaceholderPage'
import TodayPage from './pages/TodayPage'
import LeadsPage from './pages/LeadsPage'
import { ADMIN_BASE } from './access'
import './admin.css'

// Lazy-loaded from App.jsx, so field agents on the mobile app never download it.

// Sections not built yet: honest placeholders pointing to where the job is done today.
const PLACEHOLDER_PAGES = [
  {
    path: '/followups',
    title: 'Follow-ups',
    summary: 'Team ke saare follow-ups: overdue, aaj, is hafte.',
    coming: ['Overdue / Aaj / Is hafte', 'Reassign, done, snooze'],
    useMobileFor: 'follow-ups dekhna',
  },
  {
    path: '/team',
    title: 'Team',
    summary: 'Users approve karein, roles badlein, agent hatne par leads shift karein.',
    coming: ['Approve / reject', 'Role badalna', 'Deactivate', 'Saari leads doosre agent ko dena'],
    useMobileFor: 'users approve karna aur roles badalna',
  },
  {
    path: '/loans',
    title: 'Loans',
    summary: 'ROI mein save hue loan amounts, agent ke hisaab se.',
    coming: ['Loan amount, tenure aur EMI ki list', 'Login Done files ka loan pipeline'],
  },
]

/** Moves focus to <main> after in-app navigation so screen readers announce the new page. */
function FocusMainOnNavigate() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    document.getElementById('admin-main')?.focus()
  }, [pathname])
  return null
}

export default function AdminApp() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('admin-root')
    return () => html.classList.remove('admin-root')
  }, [])

  return (
    <BrowserRouter basename={ADMIN_BASE}>
      <FocusMainOnNavigate />
      <AdminLayout>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          {PLACEHOLDER_PAGES.map(p => (
            <Route
              key={p.path}
              path={p.path}
              element={<PlaceholderPage title={p.title} summary={p.summary} coming={p.coming} useMobileFor={p.useMobileFor} />}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    </BrowserRouter>
  )
}
