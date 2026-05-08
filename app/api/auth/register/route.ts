import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError, publicMutationOriginJsonResponse } from '@/lib/public-mutation-origin'
import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGISTER_RATE_LIMIT_WINDOW_MS = 60_000
const REGISTER_RATE_LIMIT_MAX = 8

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: Request) {
  const originErr = getPublicMutationOriginError(req)
  if (originErr) return publicMutationOriginJsonResponse(originErr)

  const ip = getClientIp(req.headers)
  const store = getRateLimitStore()
  const bucket = await store.incr(`public:auth-register:${ip}`, REGISTER_RATE_LIMIT_WINDOW_MS)
  if (bucket.count > REGISTER_RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  const o = body as Record<string, unknown>
  const honeypot = typeof o.website === 'string' ? o.website.trim() : ''
  if (honeypot) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const nameRaw = typeof o.name === 'string' ? o.name.trim() : ''
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : ''
  const password = typeof o.password === 'string' ? o.password : ''
  const passwordConfirm = typeof o.passwordConfirm === 'string' ? o.passwordConfirm : ''
  const privacyNoticeConfirmed = o.privacyNoticeConfirmed === true
  const privacyNoticeVersion = typeof o.privacyNoticeVersion === 'string' ? o.privacyNoticeVersion.trim() : ''
  const marketingConsent = o.marketingConsent === true
  const marketingConsentVersion =
    typeof o.marketingConsentVersion === 'string' ? o.marketingConsentVersion.trim() : ''

  if (!nameRaw) {
    return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 })
  }
  if (nameRaw.length > 80) {
    return NextResponse.json({ error: '이름은 80자 이내로 입력해 주세요.' }, { status: 400 })
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '유효한 이메일을 입력해 주세요.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
  }
  if (!passwordConfirm) {
    return NextResponse.json({ error: '비밀번호 확인을 입력해 주세요.' }, { status: 400 })
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 400 })
  }
  if (!privacyNoticeConfirmed) {
    return NextResponse.json(
      { error: '회원가입을 위한 개인정보 수집·이용 안내 확인이 필요합니다.' },
      { status: 400 }
    )
  }
  if (!privacyNoticeVersion) {
    return NextResponse.json({ error: '개인정보 안내 버전 정보가 누락되었습니다.' }, { status: 400 })
  }

  const birthDateRaw = typeof o.birthDate === 'string' ? o.birthDate.trim() : ''
  let birthDate: Date | undefined
  if (birthDateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)) {
      return NextResponse.json({ error: '생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)' }, { status: 400 })
    }
    birthDate = new Date(`${birthDateRaw}T12:00:00.000Z`)
    if (Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: '생년월일이 올바르지 않습니다.' }, { status: 400 })
    }
  }

  let referredByCode: string | null =
    typeof o.referredByCode === 'string' && o.referredByCode.trim() ? o.referredByCode.trim().toUpperCase() : null
  if (referredByCode && !/^BONG-[0-9A-F]{6}$/.test(referredByCode)) {
    return NextResponse.json({ error: '추천 코드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const role = bootstrapRoleForNewUserEmail(email)

  const user = await prisma.user.create({
    data: {
      name: nameRaw,
      email,
      passwordHash,
      signupMethod: 'email',
      accountStatus: 'active',
      role: role ?? undefined,
      privacyNoticeConfirmedAt: new Date(),
      privacyNoticeVersion,
      marketingConsent,
      marketingConsentAt: marketingConsent ? new Date() : null,
      marketingConsentVersion: marketingConsent ? marketingConsentVersion || 'member-marketing-v1' : null,
      birthDate: birthDate ?? undefined,
      referredByCode: referredByCode ?? undefined,
      referredAt: referredByCode ? new Date() : undefined,
    },
    select: { id: true, email: true },
  })

  void runNewUserCouponBootstrap(user.id).catch((e) => {
    console.warn('[auth/register] coupon_bootstrap', e)
  })

  return NextResponse.json({ ok: true, user })
}
