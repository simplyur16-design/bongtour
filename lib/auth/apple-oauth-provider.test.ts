import { describe, expect, it } from 'vitest'
import { isAppleOAuthConfigured, normalizeApplePrivateKeyPem } from '@/lib/auth/apple-oauth-provider'

describe('apple-oauth-provider', () => {
  it('wraps bare key body as PEM', () => {
    const pem = normalizeApplePrivateKeyPem('abc123')
    expect(pem).toContain('BEGIN PRIVATE KEY')
    expect(pem).toContain('abc123')
  })

  it('is configured with team/key/privateKey trio', () => {
    process.env.AUTH_APPLE_ID = 'com.example.signin'
    process.env.AUTH_APPLE_TEAM_ID = 'TEAM123456'
    process.env.AUTH_APPLE_KEY_ID = 'KEY1234567'
    process.env.AUTH_APPLE_PRIVATE_KEY = 'MIGTAgEAMBMG'
    expect(isAppleOAuthConfigured()).toBe(true)
    delete process.env.AUTH_APPLE_ID
    delete process.env.AUTH_APPLE_TEAM_ID
    delete process.env.AUTH_APPLE_KEY_ID
    delete process.env.AUTH_APPLE_PRIVATE_KEY
  })
})
