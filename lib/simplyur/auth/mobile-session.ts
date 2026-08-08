/**
 * simplyur in-app auth exchange — email / Google id_token / Apple identity_token → Bearer.
 * REGRESSION-FREEZE[simplyur-inapp-auth]: mobile-session SSOT — manifest
 */
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'
import {
  isValidSimplyurSignupEmail,
  normalizeSimplyurSignupEmail,
} from '@/lib/simplyur/auth/register-email'
import { mintSimplyurMobileAccessToken } from '@/lib/simplyur/auth/mobile-access-token'

export type SimplyurMobileSessionFailCode =
  | 'invalid_payload'
  | 'invalid_credentials'
  | 'oauth_not_configured'
  | 'oauth_invalid_token'
  | 'account_restricted'

export type SimplyurMobileSessionResult =
  | {
      ok: true
      accessToken: string
      expiresAt: number
      email: string
      userId: string
    }
  | { ok: false; code: SimplyurMobileSessionFailCode }

const APPLE_ISSUER = 'https://appleid.apple.com'
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))

function googleClientIds(): string[] {
  return [
    process.env.AUTH_GOOGLE_ID?.trim(),
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.AUTH_GOOGLE_IOS_ID?.trim(),
    process.env.GOOGLE_IOS_CLIENT_ID?.trim(),
    process.env.AUTH_GOOGLE_ANDROID_ID?.trim(),
    process.env.GOOGLE_ANDROID_CLIENT_ID?.trim(),
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim(),
  ].filter((v): v is string => Boolean(v))
}

function appleAudiences(): string[] {
  return [
    process.env.AUTH_APPLE_ID?.trim(),
    process.env.APPLE_ID?.trim(),
    process.env.AUTH_APPLE_BUNDLE_ID?.trim(),
    'com.bongtour.simplyur',
  ].filter((v): v is string => Boolean(v))
}

async function issueForUser(user: { id: string; email: string | null; accountStatus: string }) {
  if (user.accountStatus === 'suspended' || user.accountStatus === 'withdrawn') {
    return { ok: false as const, code: 'account_restricted' as const }
  }
  const email = (user.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return { ok: false as const, code: 'invalid_credentials' as const }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const minted = await mintSimplyurMobileAccessToken({ userId: user.id, email })
  return {
    ok: true as const,
    accessToken: minted.accessToken,
    expiresAt: minted.expiresAt,
    email,
    userId: user.id,
  }
}

async function upsertOAuthUser(args: {
  email: string
  name?: string | null
  provider: 'google' | 'apple'
  providerAccountId: string
}): Promise<SimplyurMobileSessionResult> {
  const email = normalizeSimplyurSignupEmail(args.email)
  if (!isValidSimplyurSignupEmail(email)) return { ok: false, code: 'oauth_invalid_token' }

  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, accountStatus: true, signupMethod: true },
  })

  if (!user) {
    const role = bootstrapRoleForNewUserEmail(email)
    user = await prisma.user.create({
      data: {
        email,
        name: args.name?.trim() || null,
        signupMethod: args.provider,
        socialProvider: args.provider,
        socialProviderUserId: args.providerAccountId,
        accountStatus: 'active',
        role: role ?? undefined,
        emailVerified: new Date(),
      },
      select: { id: true, email: true, accountStatus: true, signupMethod: true },
    })
    void runNewUserCouponBootstrap(user.id).catch(() => {})
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        socialProvider: args.provider,
        socialProviderUserId: args.providerAccountId,
        ...(user.signupMethod?.trim() ? {} : { signupMethod: args.provider }),
        emailVerified: new Date(),
      },
    })
  }

  // Link Auth.js Account row when missing (optional best-effort)
  try {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: args.provider,
          providerAccountId: args.providerAccountId,
        },
      },
      create: {
        userId: user.id,
        type: 'oidc',
        provider: args.provider,
        providerAccountId: args.providerAccountId,
      },
      update: { userId: user.id },
    })
  } catch {
    /* unique conflicts ok */
  }

  return issueForUser(user)
}

export async function createSimplyurMobileSessionFromCredentials(args: {
  email: string
  password: string
}): Promise<SimplyurMobileSessionResult> {
  const email = normalizeCredentialsLoginEmail(args.email)
  const password = args.password ?? ''
  if (!email || !password) return { ok: false, code: 'invalid_credentials' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, accountStatus: true, passwordHash: true },
  })
  if (!user?.passwordHash) return { ok: false, code: 'invalid_credentials' }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return { ok: false, code: 'invalid_credentials' }
  return issueForUser(user)
}

export async function createSimplyurMobileSessionFromGoogleIdToken(
  idToken: string,
): Promise<SimplyurMobileSessionResult> {
  const audiences = googleClientIds()
  if (audiences.length === 0) return { ok: false, code: 'oauth_not_configured' }

  try {
    const client = new OAuth2Client()
    const ticket = await client.verifyIdToken({ idToken: idToken.trim(), audience: audiences })
    const payload = ticket.getPayload()
    const email = payload?.email?.trim().toLowerCase() ?? ''
    const sub = payload?.sub?.trim() ?? ''
    if (!email || !sub || payload?.email_verified === false) {
      return { ok: false, code: 'oauth_invalid_token' }
    }
    return upsertOAuthUser({
      email,
      name: payload.name ?? null,
      provider: 'google',
      providerAccountId: sub,
    })
  } catch {
    return { ok: false, code: 'oauth_invalid_token' }
  }
}

export async function createSimplyurMobileSessionFromAppleIdentityToken(
  identityToken: string,
): Promise<SimplyurMobileSessionResult> {
  const audiences = appleAudiences()
  if (audiences.length === 0) return { ok: false, code: 'oauth_not_configured' }

  try {
    const { payload } = await jwtVerify(identityToken.trim(), appleJwks, {
      issuer: APPLE_ISSUER,
      audience: audiences,
    })
    const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!sub) return { ok: false, code: 'oauth_invalid_token' }

    // Apple may omit email on subsequent sign-ins — look up by Account
    if (!email) {
      const linked = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider: 'apple', providerAccountId: sub },
        },
        select: {
          user: { select: { id: true, email: true, accountStatus: true } },
        },
      })
      if (!linked?.user) return { ok: false, code: 'oauth_invalid_token' }
      return issueForUser(linked.user)
    }

    return upsertOAuthUser({
      email,
      name: null,
      provider: 'apple',
      providerAccountId: sub,
    })
  } catch {
    return { ok: false, code: 'oauth_invalid_token' }
  }
}
