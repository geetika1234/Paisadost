import { describe, it, expect } from 'vitest'
import { friendlyDbError } from './errors'

describe('friendlyDbError', () => {
  it('maps a known database refusal to an actionable message', () => {
    expect(friendlyDbError({ message: 'delete_not_allowed' })).toMatch(/apni aaj ki nayi lead/)
    expect(friendlyDbError({ message: 'profile_privilege_change_denied' })).toMatch(/sirf admin/)
  })

  it('keeps unknown errors visible rather than hiding them', () => {
    expect(friendlyDbError({ message: 'network down' })).toBe('network down')
  })

  it('falls back when there is no message', () => {
    expect(friendlyDbError(null, 'Fallback')).toBe('Fallback')
  })
})
