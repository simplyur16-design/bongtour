import { describe, expect, it } from 'vitest'
import { isSafeSimplyurOAuthReturnPath } from '@/lib/auth/simplyur-oauth-return-cookie'

describe('simplyur oauth return cookie path', () => {
  it('allows only simplyur relative paths', () => {
    expect(isSafeSimplyurOAuthReturnPath('/simplyur/en/oauth-complete')).toBe(true)
    expect(isSafeSimplyurOAuthReturnPath('/simplyur/ja/my-esim')).toBe(true)
    expect(isSafeSimplyurOAuthReturnPath('/')).toBe(false)
    expect(isSafeSimplyurOAuthReturnPath('/m')).toBe(false)
    expect(isSafeSimplyurOAuthReturnPath('https://bongtour.com/simplyur/en/oauth-complete')).toBe(
      false,
    )
    expect(isSafeSimplyurOAuthReturnPath('//evil.test')).toBe(false)
  })
})
