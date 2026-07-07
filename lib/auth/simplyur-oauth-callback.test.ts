import { describe, expect, it } from 'vitest'
import {
  parseOAuthStartReturnTo,
  parseSimplyurOAuthLocale,
  resolveOAuthStartCallbackPath,
  safeSimplyurOAuthCallbackPath,
  simplyurMobileDeepLink,
  simplyurOAuthCompleteWebPath,
} from '@/lib/auth/simplyur-oauth-callback'

describe('simplyur-oauth-callback SSOT', () => {
  it('parses locale with en fallback', () => {
    expect(parseSimplyurOAuthLocale('ja')).toBe('ja')
    expect(parseSimplyurOAuthLocale('xx')).toBe('en')
  })

  it('rejects off-site callback paths', () => {
    expect(safeSimplyurOAuthCallbackPath('https://evil.test', '/simplyur/en/my-esim')).toBe(
      '/simplyur/en/my-esim',
    )
  })

  it('resolves web vs app return targets', () => {
    expect(
      resolveOAuthStartCallbackPath({
        returnTo: 'web',
        locale: 'ja',
        callbackUrlRaw: '/simplyur/ja/my-esim',
      }),
    ).toBe('/simplyur/ja/my-esim')
    expect(
      resolveOAuthStartCallbackPath({
        returnTo: 'app',
        locale: 'vi',
        callbackUrlRaw: null,
      }),
    ).toBe(simplyurOAuthCompleteWebPath('vi'))
  })

  it('builds mobile deep links', () => {
    expect(simplyurMobileDeepLink('oauth-complete?status=success')).toBe(
      'simplyur://oauth-complete?status=success',
    )
  })

  it('parseOAuthStartReturnTo', () => {
    expect(parseOAuthStartReturnTo('app')).toBe('app')
    expect(parseOAuthStartReturnTo('web')).toBe('web')
    expect(parseOAuthStartReturnTo(null)).toBe('web')
  })
})
