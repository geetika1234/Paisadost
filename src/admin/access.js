// Who may open the desktop admin console, and which URLs belong to it.
//
// This is a UX gate only. Data access is enforced in Postgres (migrations/),
// so a user who forces their way onto /admin still gets nothing they could
// not already read from the mobile app.

export const ADMIN_BASE = '/admin'

const ADMIN_ROLES = new Set(['admin', 'manager'])

export function isAdminPath(pathname = '') {
  return pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`)
}

export function canAccessAdmin(profile) {
  return !!profile?.is_approved && ADMIN_ROLES.has(profile.role)
}
