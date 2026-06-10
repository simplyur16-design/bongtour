import { describe, expect, it } from 'vitest'
import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'

describe('resolveOAuthStateCookieDomain', () => {
  it('returns undefined for loopback', () => {
    expect(resolveOAuthStateCookieDomain('localhost')).toBeUndefined()
    expect(resolveOAuthStateCookieDomain('127.0.0.1')).toBeUndefined()
  })

  it('uses apex domain for www hostnames', () => {
    expect(resolveOAuthStateCookieDomain('www.bongtour.com')).toBe('.bongtour.com')
  })

  it('uses apex domain for apex hostnames (www·apex state cookie share)', () => {
    expect(resolveOAuthStateCookieDomain('bongtour.com')).toBe('.bongtour.com')
  })
})
