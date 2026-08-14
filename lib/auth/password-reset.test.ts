import { describe, expect, it } from 'vitest'
import {
  buildPasswordResetLink,
  buildPasswordResetPath,
  emailFromPasswordResetIdentifier,
  generatePasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetTokenShape,
  isValidPasswordResetEmail,
  normalizePasswordResetEmail,
  passwordResetIdentifier,
  PASSWORD_RESET_IDENTIFIER_PREFIX,
  PASSWORD_RESET_TTL_MS,
} from '@/lib/auth/password-reset'
import { validateSimplyurSignupPassword } from '@/lib/simplyur/auth/register-email'
import { getSmtpHost, isSmtpConfigured, smtpMissingEnvKeys } from '@/lib/smtp-env'

describe('auth password reset helpers', () => {
  it('builds identifier password-reset:email', () => {
    expect(passwordResetIdentifier('a@b.co')).toBe(`${PASSWORD_RESET_IDENTIFIER_PREFIX}a@b.co`)
    expect(emailFromPasswordResetIdentifier('password-reset:traveler@example.com')).toBe(
      'traveler@example.com',
    )
    expect(emailFromPasswordResetIdentifier('email-verify:x')).toBeNull()
  })

  it('normalizes bongtour test IDs and simplyur emails', () => {
    expect(normalizePasswordResetEmail('  Foo  ', 'bongtour')).toBe('foo@test.bongtour')
    expect(normalizePasswordResetEmail('  Traveler@Example.COM ', 'simplyur')).toBe(
      'traveler@example.com',
    )
    expect(isValidPasswordResetEmail('traveler@example.com', 'simplyur')).toBe(true)
    expect(isValidPasswordResetEmail('noid', 'simplyur')).toBe(false)
  })

  it('generates 64-hex tokens and hashes deterministically', () => {
    const token = generatePasswordResetToken()
    expect(isPasswordResetTokenShape(token)).toBe(true)
    expect(hashPasswordResetToken(token)).toHaveLength(64)
    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token))
    expect(isPasswordResetTokenShape('short')).toBe(false)
  })

  it('builds surface-specific reset paths', () => {
    expect(
      buildPasswordResetPath({
        surface: 'bongtour',
        token: 'a'.repeat(64),
        email: 'u@test.bongtour',
      }),
    ).toContain('/auth/reset-password?')
    expect(
      buildPasswordResetPath({
        surface: 'simplyur',
        locale: 'ja',
        token: 'a'.repeat(64),
        email: 'u@example.com',
      }),
    ).toContain('/simplyur/ja/reset-password?')
    expect(
      buildPasswordResetPath({
        surface: 'simplyur',
        client: 'mobile',
        token: 'a'.repeat(64),
        email: 'u@example.com',
      }),
    ).toBe(`/sign-in/reset?token=${'a'.repeat(64)}&email=${encodeURIComponent('u@example.com')}`)
  })

  it('reuses simplyur signup password rule (min 8) and ~1h TTL', () => {
    expect(validateSimplyurSignupPassword('short')).toBe(false)
    expect(validateSimplyurSignupPassword('longenough')).toBe(true)
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000)
  })

  it('tags mobile HTTPS reset with returnTo=app for app bounce-back', () => {
    const token = 'a'.repeat(64)
    const email = 'u@example.com'
    const web = buildPasswordResetLink({
      surface: 'simplyur',
      locale: 'en',
      client: 'web',
      token,
      email,
      returnToApp: true,
    })
    expect(web).toContain('/simplyur/en/reset-password?')
    expect(web).toContain('returnTo=app')
    expect(
      buildPasswordResetLink({
        surface: 'simplyur',
        client: 'mobile',
        token,
        email,
      }),
    ).toBe(`simplyur://sign-in/reset?token=${token}&email=${encodeURIComponent(email)}`)
  })

  it('resolves SMTP host via SMTP_MAIL_HOST alias when SMTP_HOST empty', () => {
    const prevHost = process.env.SMTP_HOST
    const prevAlias = process.env.SMTP_MAIL_HOST
    delete process.env.SMTP_HOST
    process.env.SMTP_MAIL_HOST = 'smtp.naver.com'
    expect(getSmtpHost()).toBe('smtp.naver.com')
    process.env.SMTP_HOST = prevHost
    process.env.SMTP_MAIL_HOST = prevAlias
  })

  it('reports smtpMissingEnvKeys when required vars absent', () => {
    const keys = [
      'SMTP_HOST',
      'SMTP_MAIL_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM_NAME',
      'SMTP_FROM_EMAIL',
    ] as const
    const prev: Record<string, string | undefined> = {}
    for (const k of keys) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
    expect(isSmtpConfigured()).toBe(false)
    expect(smtpMissingEnvKeys()).toContain('SMTP_HOST|SMTP_MAIL_HOST')
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })
})
