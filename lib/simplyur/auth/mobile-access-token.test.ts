import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRestrictedAccountStatus } from '@/lib/account-status'
import { readBearerToken } from '@/lib/simplyur/auth/mobile-access-token'

describe('simplyur mobile access token helpers', () => {
  it('marks suspended/withdrawn as restricted', () => {
    expect(isRestrictedAccountStatus('active')).toBe(false)
    expect(isRestrictedAccountStatus('suspended')).toBe(true)
    expect(isRestrictedAccountStatus('withdrawn')).toBe(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('reads Bearer from Authorization header', () => {
    const req = new Request('https://bongtour.com/api', {
      headers: { Authorization: 'Bearer abc.def.ghi' },
    })
    expect(readBearerToken(req)).toBe('abc.def.ghi')
  })

  it('mints and verifies round-trip when AUTH_SECRET set', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-for-simplyur-mobile-jwt-roundtrip')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.resetModules()
    const { mintSimplyurMobileAccessToken, verifySimplyurMobileAccessToken } = await import(
      '@/lib/simplyur/auth/mobile-access-token'
    )
    const { accessToken } = await mintSimplyurMobileAccessToken({
      userId: 'user_1',
      email: 'traveler@example.com',
    })
    await expect(verifySimplyurMobileAccessToken(accessToken)).resolves.toEqual({
      userId: 'user_1',
      email: 'traveler@example.com',
    })
  })
})
