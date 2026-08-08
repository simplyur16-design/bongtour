import { describe, expect, it } from 'vitest'
import {
  isValidSimplyurSignupEmail,
  normalizeSimplyurSignupEmail,
  validateSimplyurSignupPassword,
} from '@/lib/simplyur/auth/register-email'

describe('simplyur email signup validation', () => {
  it('normalizes email without inventing a test domain', () => {
    expect(normalizeSimplyurSignupEmail('  Traveler@Example.COM ')).toBe('traveler@example.com')
    expect(normalizeSimplyurSignupEmail('noid')).toBe('noid')
    expect(isValidSimplyurSignupEmail(normalizeSimplyurSignupEmail('noid'))).toBe(false)
  })

  it('accepts basic visitor emails', () => {
    expect(isValidSimplyurSignupEmail('a@b.co')).toBe(true)
    expect(isValidSimplyurSignupEmail('not-an-email')).toBe(false)
    expect(isValidSimplyurSignupEmail('a@b')).toBe(false)
  })

  it('requires password length >= 8', () => {
    expect(validateSimplyurSignupPassword('short')).toBe(false)
    expect(validateSimplyurSignupPassword('longenough')).toBe(true)
  })
})
