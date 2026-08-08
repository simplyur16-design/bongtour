/**
 * simplyur foreign-visitor email signup (not domestic Kakao/Naver).
 * Domestic `/api/auth/register` stays 410 EMAIL_SIGNUP_DISABLED.
 * REGRESSION-FREEZE[simplyur-email-signup]: simplyur email register SSOT — manifest
 */
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'

const PRIVACY_VERSION = 'simplyur-privacy-v1'
const TERMS_VERSION = 'simplyur-terms-v1'
export const SIMPLYUR_SIGNUP_MIN_PASSWORD_LEN = 8

export type SimplyurEmailRegisterFailCode =
  | 'invalid_email'
  | 'weak_password'
  | 'email_taken'
  | 'terms_required'

export type SimplyurEmailRegisterResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; code: SimplyurEmailRegisterFailCode }

/** Signup email — no test-domain fallback (unlike credentials login). */
export function normalizeSimplyurSignupEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidSimplyurSignupEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  // Basic shape: local@domain.tld (no spaces)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateSimplyurSignupPassword(password: string): boolean {
  return password.length >= SIMPLYUR_SIGNUP_MIN_PASSWORD_LEN
}

export async function registerSimplyurEmailUser(args: {
  email: string
  password: string
  termsAccepted: boolean
}): Promise<SimplyurEmailRegisterResult> {
  if (!args.termsAccepted) return { ok: false, code: 'terms_required' }

  const email = normalizeSimplyurSignupEmail(args.email)
  if (!isValidSimplyurSignupEmail(email)) return { ok: false, code: 'invalid_email' }
  if (!validateSimplyurSignupPassword(args.password)) return { ok: false, code: 'weak_password' }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) return { ok: false, code: 'email_taken' }

  const passwordHash = await bcrypt.hash(args.password, 12)
  const now = new Date()
  const role = bootstrapRoleForNewUserEmail(email)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      signupMethod: 'email',
      accountStatus: 'active',
      role: role ?? undefined,
      termsConsentAt: now,
      termsConsentVersion: TERMS_VERSION,
      privacyNoticeConfirmedAt: now,
      privacyNoticeVersion: PRIVACY_VERSION,
      marketingConsent: false,
    },
    select: { id: true, email: true },
  })

  void runNewUserCouponBootstrap(user.id).catch((e) => {
    console.warn('[simplyur:register] coupon_bootstrap', e)
  })

  return { ok: true, userId: user.id, email: user.email! }
}
