import { describe, expect, it } from 'vitest'
import { isOAuthMobileStartProvider, safeOAuthCallbackUrl } from '@/lib/auth/oauth-mobile-start'

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
})
