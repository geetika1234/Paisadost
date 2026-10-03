import { describe, it, expect } from 'vitest'
import { isAdminPath, canAccessAdmin } from './access'

describe('isAdminPath', () => {
  it.each([
    ['/admin', true],
    ['/admin/', true],
    ['/admin/leads/123', true],
    ['/', false],
    ['/administrator', false],
    ['/x/admin', false],
    ['', false],
  ])('%s → %s', (path, expected) => {
    expect(isAdminPath(path)).toBe(expected)
  })
})

describe('canAccessAdmin', () => {
  it.each([
    [{ role: 'admin',   is_approved: true },  true],
    [{ role: 'manager', is_approved: true },  true],
    [{ role: 'sales',   is_approved: true },  false],
    [{ role: 'admin',   is_approved: false }, false],
    [null, false],
  ])('%o → %s', (profile, expected) => {
    expect(canAccessAdmin(profile)).toBe(expected)
  })
})
