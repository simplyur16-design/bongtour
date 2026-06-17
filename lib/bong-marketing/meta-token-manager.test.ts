import { describe, it, expect } from 'vitest'
import { shouldRefreshMetaToken } from '@/lib/bong-marketing/meta-token-manager'

describe('meta-token-manager', () => {
  const now = new Date('2026-06-16T12:00:00.000Z')

  it('returns true when expiry within 30 days', () => {
    const expiresAt = new Date('2026-07-01T12:00:00.000Z')
    expect(shouldRefreshMetaToken(expiresAt, now)).toBe(true)
  })

  it('returns false when expiry beyond 30 days', () => {
    const expiresAt = new Date('2026-09-01T12:00:00.000Z')
    expect(shouldRefreshMetaToken(expiresAt, now)).toBe(false)
  })
})
