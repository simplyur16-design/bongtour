import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authDebugLog,
  authSecurityWarn,
  isAuthDebugEnabled,
  isOAuthProviderTraceEnabled,
} from '@/lib/auth/auth-debug'

describe('auth-debug SSOT', () => {
  const env = process.env

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...env }
    delete process.env.AUTH_DEBUG
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = env
  })

  it('isAuthDebugEnabled — development only by default in test', () => {
    expect(isAuthDebugEnabled()).toBe(false)
    process.env.NODE_ENV = 'development'
    expect(isAuthDebugEnabled()).toBe(true)
  })

  it('AUTH_DEBUG=1 enables in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.AUTH_DEBUG = '1'
    expect(isAuthDebugEnabled()).toBe(true)
  })

  it('authDebugLog is silent unless debug enabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    authDebugLog('test', 'hello')
    expect(spy).not.toHaveBeenCalled()
    process.env.AUTH_DEBUG = '1'
    authDebugLog('test', 'hello')
    expect(spy).toHaveBeenCalledWith('[auth:test]', 'hello')
  })

  it('authSecurityWarn always logs', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    authSecurityWarn('oauth', 'state mismatch')
    expect(spy).toHaveBeenCalled()
  })

  it('isOAuthProviderTraceEnabled respects provider env', () => {
    expect(isOAuthProviderTraceEnabled(undefined)).toBe(false)
    expect(isOAuthProviderTraceEnabled('1')).toBe(true)
  })
})
