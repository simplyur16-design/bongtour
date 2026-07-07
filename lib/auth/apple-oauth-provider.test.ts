import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  isApplePrivateKeyPemPlausible,
  normalizeApplePrivateKeyPem,
} from '@/lib/auth/apple-private-key-pem'
import { appleOAuthProvider, isAppleOAuthConfigured } from '@/lib/auth/apple-oauth-provider'

describe('apple-private-key-pem', () => {
  it('wraps bare key body as PEM', () => {
    const pem = normalizeApplePrivateKeyPem('abc123')
    expect(pem).toContain('BEGIN PRIVATE KEY')
    expect(pem).toContain('abc123')
  })

  it('rejects BEGIN-only paste (truncated .p8)', () => {
    expect(isApplePrivateKeyPemPlausible('-----BEGIN PRIVATE KEY-----')).toBe(false)
  })
})

describe('apple-oauth-provider', () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('is not configured when .p8 body is too short', () => {
    process.env.AUTH_APPLE_ID = 'com.example.signin'
    process.env.AUTH_APPLE_TEAM_ID = 'TEAM123456'
    process.env.AUTH_APPLE_KEY_ID = 'KEY1234567'
    process.env.AUTH_APPLE_PRIVATE_KEY = 'MIGTAgEAMBMG'
    expect(isAppleOAuthConfigured()).toBe(false)
  })

  it('does not throw when .p8 is truncated at startup', () => {
    process.env.AUTH_APPLE_ID = 'com.example.signin'
    process.env.AUTH_APPLE_TEAM_ID = 'TEAM123456'
    process.env.AUTH_APPLE_KEY_ID = 'KEY1234567'
    process.env.AUTH_APPLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----'
    expect(() => appleOAuthProvider()).not.toThrow()
    expect(appleOAuthProvider()).toBeNull()
  })

  it('is configured with static JWT secret', () => {
    process.env.AUTH_APPLE_ID = 'com.example.signin'
    process.env.AUTH_APPLE_SECRET = 'jwt-secret'
    expect(isAppleOAuthConfigured()).toBe(true)
    expect(appleOAuthProvider()).not.toBeNull()
  })
})
