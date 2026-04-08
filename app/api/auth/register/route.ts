import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError, publicMutationOriginJsonResponse } from '@/lib/public-mutation-origin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGISTER_RATE_LIMIT_WINDOW_MS = 60_000
const REGISTER_RATE_LIMIT_MAX = 8

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const store = getRateLimitStore()
  const bucket = await store.incr(`public:auth-register:${ip}`, REGISTER_RATE_LIMIT_WINDOW_MS)
  if (bucket.count > REGISTER_RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } }
    )
  }

  const originErr = getPublicMutationOriginError(req)
  if (originErr) return publicMutationOriginJsonResponse(originErr)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  const o = body as Record<string, unknown>
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : ''
  const password = typeof o.password === 'string' ? o.password : ''
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const privacyNoticeConfirmed = o.privacyNoticeConfirmed === true
  const privacyNoticeVersion = typeof o.privacyNoticeVersion === 'string' ? o.privacyNoticeVersion.trim() : ''
  const marketingConsent = o.marketingConsent === true
  const marketingConsentVersion =
    typeof o.marketingConsentVersion === 'string' ? o.marketingConsentVersion.trim() : ''

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '유효한 이메일을 입력해 주세요.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
  }
  if (!name || name.length > 80) {
    return NextResponse.json({ error: '이름을 입력해 주세요. (80자 이내)' }, { status: 400 })
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

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const role = bootstrapRoleForNewUserEmail(email)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      signupMethod: 'email',
      accountStatus: 'active',
      role: role ?? undefined,
      privacyNoticeConfirmedAt: new Date(),
      privacyNoticeVersion,
      marketingConsent,
      marketingConsentAt: marketingConsent ? new Date() : null,
      marketingConsentVersion: marketingConsent ? marketingConsentVersion || 'member-marketing-v1' : null,
    },
    select: { id: true, email: true, name: true },
  })

  return NextResponse.json({ ok: true, user })
}
