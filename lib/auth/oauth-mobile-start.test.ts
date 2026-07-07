import { describe, expect, it } from 'vitest'
import {
  buildOAuthAutoPostHtml,
  buildOAuthClientCsrfPostHtml,
  isOAuthMobileStartProvider,
  safeOAuthCallbackUrl,
} from '@/lib/auth/oauth-mobile-start'

describe('oauth-mobile-start', () => {
  it('allows google and apple only', () => {
    expect(isOAuthMobileStartProvider('google')).toBe(true)
    expect(isOAuthMobileStartProvider('apple')).toBe(true)
    expect(isOAuthMobileStartProvider('kakao')).toBe(false)
  })

  it('rejects off-site callbackUrl', () => {
    expect(safeOAuthCallbackUrl('https://evil.example/phish')).toBe('/simplyur/en/my-esim')
    expect(safeOAuthCallbackUrl('//evil.example/phish')).toBe('/simplyur/en/my-esim')
  })

  it('accepts same-origin relative callbackUrl', () => {
    expect(safeOAuthCallbackUrl('/simplyur/ja/my-esim')).toBe('/simplyur/ja/my-esim')
  })

  it('builds client-side CSRF fetch html', () => {
    const html = buildOAuthClientCsrfPostHtml({
      provider: 'google',
      callbackUrl: '/simplyur/en/my-esim',
    })
    expect(html).toContain("fetch('/api/auth/csrf'")
    expect(html).toContain('action="/api/auth/signin/google"')
  })

  it('builds legacy auto-POST html for NextAuth signin', () => {
    const html = buildOAuthAutoPostHtml({
      provider: 'google',
      callbackUrl: '/simplyur/en/my-esim',
      csrfToken: 'csrf-test',
    })
    expect(html).toContain('method="POST"')
    expect(html).toContain('value="csrf-test"')
  })
})
