import { afterEach, describe, expect, it, vi } from 'vitest'

describe('authJsOAuthCookieOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses SameSite=None on https origin for cross-site Apple/Google return', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bongtour.com')
    vi.resetModules()
    const { authJsCookieOptions, authJsOAuthCookieOptions } = await import(
      '@/lib/auth/auth-js-cookie-options'
    )
    const oauth = authJsOAuthCookieOptions()
    const session = authJsCookieOptions()
    expect(oauth.sameSite).toBe('none')
    expect(oauth.secure).toBe(true)
    expect(session.sameSite).toBe('lax')
  })

  it('keeps Lax on localhost http', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXTAUTH_URL', '')
    vi.resetModules()
    const { authJsOAuthCookieOptions } = await import('@/lib/auth/auth-js-cookie-options')
    expect(authJsOAuthCookieOptions().sameSite).toBe('lax')
  })
})
