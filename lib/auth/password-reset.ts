/**
 * Shared email/password reset (Bongtour + SimplyUR web/mobile).
 * Uses Prisma VerificationToken; never auto-creates accounts.
 * REGRESSION-FREEZE[auth-password-reset]: password reset SSOT — manifest
 */
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'
import {
  isValidSimplyurSignupEmail,
  normalizeSimplyurSignupEmail,
  validateSimplyurSignupPassword,
} from '@/lib/simplyur/auth/register-email'
import { isSimplyurLocale, simplyurPath, type SimplyurLocale, SIMPLYUR_DEFAULT_LOCALE } from '@/lib/simplyur/constants'
import { absoluteUrl } from '@/lib/site-metadata'
import { sendPasswordResetMail } from '@/lib/auth/send-password-reset-mail'

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000
export const PASSWORD_RESET_IDENTIFIER_PREFIX = 'password-reset:'
export const PASSWORD_RESET_BCRYPT_ROUNDS = 12

export type PasswordResetSurface = 'bongtour' | 'simplyur'
export type PasswordResetClient = 'web' | 'mobile'

export function passwordResetIdentifier(email: string): string {
  return `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`
}

export function emailFromPasswordResetIdentifier(identifier: string): string | null {
  if (!identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) return null
  const email = identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length).trim().toLowerCase()
  return email.includes('@') ? email : null
}

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isPasswordResetTokenShape(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token)
}

export function normalizePasswordResetEmail(
  raw: string,
  surface: PasswordResetSurface,
): string {
  if (surface === 'bongtour') return normalizeCredentialsLoginEmail(raw)
  return normalizeSimplyurSignupEmail(raw)
}

export function isValidPasswordResetEmail(email: string, surface: PasswordResetSurface): boolean {
  if (!email || !email.includes('@')) return false
  if (surface === 'simplyur') return isValidSimplyurSignupEmail(email)
  // Bongtour: credentials login allows @test.bongtour IDs after normalize
  return isValidSimplyurSignupEmail(email)
}

export function buildPasswordResetPath(args: {
  surface: PasswordResetSurface
  locale?: string
  client?: PasswordResetClient
  token: string
  email: string
}): string {
  const q = `token=${encodeURIComponent(args.token)}&email=${encodeURIComponent(args.email)}`
  if (args.client === 'mobile' && args.surface === 'simplyur') {
    return `/sign-in/reset?${q}`
  }
  if (args.surface === 'simplyur') {
    const locale: SimplyurLocale = isSimplyurLocale(args.locale ?? '')
      ? (args.locale as SimplyurLocale)
      : SIMPLYUR_DEFAULT_LOCALE
    return `${simplyurPath(locale, '/reset-password')}?${q}`
  }
  return `/auth/reset-password?${q}`
}

export function buildPasswordResetLink(args: {
  surface: PasswordResetSurface
  locale?: string
  client?: PasswordResetClient
  token: string
  email: string
  /** Tag HTTPS reset so the web form can bounce back into the app after success. */
  returnToApp?: boolean
}): string {
  const path = buildPasswordResetPath(args)
  if (args.client === 'mobile' && args.surface === 'simplyur') {
    return `simplyur://${path.replace(/^\//, '')}`
  }
  const url = absoluteUrl(path)
  if (args.returnToApp) {
    const u = new URL(url)
    u.searchParams.set('returnTo', 'app')
    return u.toString()
  }
  return url
}

export type RequestPasswordResetResult = { ok: true }

/**
 * Always returns generic success (no email enumeration).
 * Sends mail only when a user with passwordHash exists.
 */
export async function requestPasswordReset(args: {
  emailRaw: string
  surface: PasswordResetSurface
  locale?: string
  client?: PasswordResetClient
}): Promise<RequestPasswordResetResult> {
  const email = normalizePasswordResetEmail(args.emailRaw, args.surface)
  if (!isValidPasswordResetEmail(email, args.surface)) {
    return { ok: true }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, accountStatus: true },
  })

  // OAuth-only / missing / inactive: still generic success, no mail
  if (!user?.passwordHash || user.accountStatus !== 'active') {
    return { ok: true }
  }

  const identifier = passwordResetIdentifier(email)
  const rawToken = generatePasswordResetToken()
  const tokenHash = hashPasswordResetToken(rawToken)
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: { identifier, token: tokenHash, expires },
  })

  // Email primary CTA is HTTPS (opens in mail clients). Mobile requests tag returnTo=app so web success can open the app.
  const fromMobile = args.client === 'mobile' && args.surface === 'simplyur'
  const resetUrl = buildPasswordResetLink({
    surface: args.surface,
    locale: args.locale,
    client: 'web',
    token: rawToken,
    email,
    returnToApp: fromMobile,
  })
  const deepLink = fromMobile
    ? buildPasswordResetLink({
        surface: 'simplyur',
        client: 'mobile',
        token: rawToken,
        email,
      })
    : undefined

  const brand = args.surface === 'simplyur' ? 'simplyur' : 'bongtour'
  const sent = await sendPasswordResetMail({ to: email, resetUrl, deepLink, brand })
  if (!sent.ok) {
    // Roll back token so a broken SMTP does not leave a usable reset hanging silently forever
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } }).catch(() => {})
    console.warn('[password-reset] mail_failed', sent.error)
  }

  return { ok: true }
}

export type ConfirmPasswordResetFailCode =
  | 'invalid_email'
  | 'invalid_token'
  | 'weak_password'
  | 'expired_or_used'
  | 'no_password_account'

export type ConfirmPasswordResetResult =
  | { ok: true }
  | { ok: false; code: ConfirmPasswordResetFailCode }

export async function confirmPasswordReset(args: {
  emailRaw: string
  token: string
  password: string
  surface: PasswordResetSurface
}): Promise<ConfirmPasswordResetResult> {
  const email = normalizePasswordResetEmail(args.emailRaw, args.surface)
  if (!isValidPasswordResetEmail(email, args.surface)) {
    return { ok: false, code: 'invalid_email' }
  }
  if (!isPasswordResetTokenShape(args.token)) {
    return { ok: false, code: 'invalid_token' }
  }
  if (!validateSimplyurSignupPassword(args.password)) {
    return { ok: false, code: 'weak_password' }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, accountStatus: true },
  })
  if (!user?.passwordHash || user.accountStatus !== 'active') {
    return { ok: false, code: 'no_password_account' }
  }

  const identifier = passwordResetIdentifier(email)
  const tokenHash = hashPasswordResetToken(args.token)
  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: tokenHash } },
  })
  if (!row || row.expires.getTime() <= Date.now()) {
    if (row) {
      await prisma.verificationToken.deleteMany({ where: { identifier } }).catch(() => {})
    }
    return { ok: false, code: 'expired_or_used' }
  }

  const passwordHash = await bcrypt.hash(args.password, PASSWORD_RESET_BCRYPT_ROUNDS)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier } }),
  ])

  return { ok: true }
}
