import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  SIMPLYUR_MOBILE_APP_SCHEME,
  buildSignInMethodHref,
  isSignInDetailMethodForAudience,
  isSignInMethodAllowedForAudience,
  isSignInMethodEnabled,
  resolveEnabledSocialSignInMethods,
  signInMethodsForAudience,
  signInSocialMethodsForAudience,
} from '@/lib/auth/sign-in-method-catalog'

describe('sign-in-method-catalog', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [
      'KAKAO_CLIENT_ID',
      'KAKAO_CLIENT_SECRET',
      'NAVER_CLIENT_ID',
      'NAVER_CLIENT_SECRET',
      'AUTH_GOOGLE_ID',
      'AUTH_GOOGLE_SECRET',
      'AUTH_APPLE_ID',
      'AUTH_APPLE_TEAM_ID',
      'AUTH_APPLE_KEY_ID',
      'AUTH_APPLE_PRIVATE_KEY',
    ]) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('email is always enabled', () => {
    expect(isSignInMethodEnabled('email')).toBe(true)
  })

  it('enables kakao when env present', () => {
    process.env.KAKAO_CLIENT_ID = 'kid'
    process.env.KAKAO_CLIENT_SECRET = 'sec'
    expect(isSignInMethodEnabled('kakao')).toBe(true)
    expect(resolveEnabledSocialSignInMethods()).toContain('kakao')
  })

  it('enables google and apple when env present', () => {
    process.env.AUTH_GOOGLE_ID = 'gid'
    process.env.AUTH_GOOGLE_SECRET = 'gsec'
    process.env.AUTH_APPLE_ID = 'aid'
    process.env.AUTH_APPLE_SECRET = 'jwt-secret'
    expect(isSignInMethodEnabled('google')).toBe(true)
    expect(isSignInMethodEnabled('apple')).toBe(true)
  })

  it('splits methods by audience — domestic web / global web / global app', () => {
    expect(signInMethodsForAudience('domestic')).toEqual(['kakao', 'naver', 'email'])
    expect(signInMethodsForAudience('globalWeb')).toEqual(['email'])
    expect(signInMethodsForAudience('globalApp')).toEqual(['email', 'google', 'apple'])
    expect(signInSocialMethodsForAudience('domestic')).toEqual(['kakao', 'naver'])
    expect(signInSocialMethodsForAudience('globalWeb')).toEqual([])
    expect(signInSocialMethodsForAudience('globalApp')).toEqual(['google', 'apple'])

    expect(isSignInMethodAllowedForAudience('google', 'domestic')).toBe(false)
    expect(isSignInMethodAllowedForAudience('google', 'globalWeb')).toBe(false)
    expect(isSignInMethodAllowedForAudience('google', 'globalApp')).toBe(true)
    expect(isSignInMethodAllowedForAudience('email', 'globalWeb')).toBe(true)

    expect(isSignInDetailMethodForAudience('email', 'domestic')).toBe(true)
    expect(isSignInDetailMethodForAudience('google', 'domestic')).toBe(false)
    expect(isSignInDetailMethodForAudience('google', 'globalWeb')).toBe(false)
    expect(isSignInDetailMethodForAudience('google', 'globalApp')).toBe(true)
    expect(isSignInDetailMethodForAudience('apple', 'globalApp')).toBe(true)
  })

  it('builds globalWeb email href on simplyur web', () => {
    expect(
      buildSignInMethodHref('email', '/simplyur/en/my-esim', { audience: 'globalWeb', simplyurLocale: 'en' }),
    ).toBe('/simplyur/en/sign-in?method=email&callbackUrl=%2Fsimplyur%2Fen%2Fmy-esim')
  })

  it('routes domestic google to mobile app scheme', () => {
    expect(buildSignInMethodHref('google', '/mypage')).toBe(SIMPLYUR_MOBILE_APP_SCHEME)
  })

  it('builds globalApp oauth deep links', () => {
    expect(buildSignInMethodHref('apple', '/simplyur/en/my-esim', { audience: 'globalApp' })).toBe(
      `${SIMPLYUR_MOBILE_APP_SCHEME}?method=apple&callbackUrl=%2Fsimplyur%2Fen%2Fmy-esim`,
    )
  })

  it('builds domestic email href — same page as social (no method=email step)', () => {
    expect(buildSignInMethodHref('email', '/mypage', { audience: 'domestic' })).toBe(
      '/auth/signin?callbackUrl=%2Fmypage',
    )
  })
})
