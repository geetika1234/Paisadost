import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import PlaceholderPage from './pages/PlaceholderPage'
import { ADMIN_BASE } from './access'
import './admin.css'

// Lazy-loaded from App.jsx, so field agents on the mobile app never download it.

const PAGES = [
  {
    path: '/',
    title: 'Today',
    summary: 'Aaj kis cheez par aapka dhyan chahiye.',
    coming: [
      'Approval ke liye ruke hue users',
      'Bina owner wali leads',
      'Overdue follow-ups, agent ke hisaab se',
      'Login ke baad sanction ka intezaar kar rahi files',
      'Is mahine ka funnel aur agent table',
    ],
  },
  {
    path: '/leads',
    title: 'Leads',
    summary: 'Saari leads ek jagah: search, filter, assign.',
    coming: [
      'Search: dukaan, malik, mobile',
      'Filters: stage, status, agent, area, date',
      'Ek saath kai leads assign karna',
      'Lead kholne par poori history aur loan details',
      'CSV export',
    ],
    useMobileFor: 'leads assign karna',
  },
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
    summary: 'Sanctioned aur disbursed files, EMI due.',
    coming: ['Mark Sanctioned', 'Mark Disbursed (UTR ke saath)', 'EMI due aur overdue'],
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
          {PAGES.map(p => (
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
