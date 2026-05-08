import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { appendNaverSessionCookie } from '@/lib/naver-auth-session'
import { assertNoInternalMetaLeak, jsonWithLeakGuard } from '@/lib/public-response-guard'
import { prisma } from '@/lib/prisma'
import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'
import {
  MARKETING_VERSION_OAUTH,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@/lib/consent/copies'

export const dynamic = 'force-dynamic'

function safeRedirectPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  try {
    const decoded = decodeURIComponent(raw.trim())
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/'
    return decoded
  } catch {
    return '/'
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'auth.signup.consent.post', { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  })
  if (!row || row.accountStatus !== 'consent_pending') {
    return jsonWithLeakGuard({ error: 'invalid_state' }, 'auth.signup.consent.post', { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonWithLeakGuard({ error: 'invalid_json' }, 'auth.signup.consent.post', { status: 400 })
  }
  const o = body as Record<string, unknown>
  const terms = o.terms === true
  const privacy = o.privacy === true
  const age = o.age === true
  const marketing = o.marketing === true
  const redirectTo = safeRedirectPath(o.callbackUrl)

  if (!terms || !privacy || !age) {
    return jsonWithLeakGuard({ error: 'required_consents_missing' }, 'auth.signup.consent.post', { status: 400 })
  }

  const now = new Date()
  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: 'active',
      termsConsentAt: now,
      termsConsentVersion: TERMS_VERSION,
      privacyNoticeConfirmedAt: now,
      privacyNoticeVersion: PRIVACY_VERSION,
      ageConfirmedAt: now,
      marketingConsent: marketing,
      marketingConsentAt: marketing ? now : null,
      marketingConsentVersion: marketing ? MARKETING_VERSION_OAUTH : null,
    },
  })

  const full = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, accountStatus: true },
  })
  if (!full) {
    return jsonWithLeakGuard({ error: 'user_missing' }, 'auth.signup.consent.post', { status: 500 })
  }

  if (marketing) {
    void runNewUserCouponBootstrap(userId)
      .then((r) => {
        if (!r.welcomeIssued && r.reason !== 'ok') {
          console.warn('[auth/signup/consent] coupon_bootstrap', r.reason)
        }
      })
      .catch((e) => console.warn('[auth/signup/consent] coupon_bootstrap', e))
  }

  const payload = { ok: true as const, redirectTo }
  try {
    assertNoInternalMetaLeak(payload, 'auth.signup.consent.post')
  } catch {
    return jsonWithLeakGuard({ error: 'internal_meta_leak_blocked' }, 'auth.signup.consent.post', { status: 500 })
  }

  const res = NextResponse.json(payload)
  const sessionOk = await appendNaverSessionCookie({
    request: req,
    response: res,
    user: {
      id: full.id,
      name: full.name,
      email: full.email,
      image: full.image,
      role: full.role,
      accountStatus: full.accountStatus ?? 'active',
    },
  })
  if (!sessionOk) {
    return jsonWithLeakGuard({ error: 'session_cookie_failed' }, 'auth.signup.consent.post', { status: 500 })
  }
  return res
}

export async function DELETE(req: Request) {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'auth.signup.consent.delete', { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  })
  if (!row || row.accountStatus !== 'consent_pending') {
    return jsonWithLeakGuard({ error: 'invalid_state' }, 'auth.signup.consent.delete', { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })
  })

  return jsonWithLeakGuard({ ok: true as const, redirectTo: '/auth/signup' }, 'auth.signup.consent.delete')
}
