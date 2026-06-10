import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { memberMarketingConsentDbFields } from '@/lib/member-marketing-consent'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mypage/marketing-consent — 본인 마케팅 수신 동의 상태
 */
export async function GET() {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      marketingConsent: true,
      marketingConsentAt: true,
      marketingConsentVersion: true,
    },
  })
  if (!user || user.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: '이용할 수 없는 계정 상태입니다.' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    marketingConsent: user.marketingConsent,
    marketingConsentAt: user.marketingConsentAt?.toISOString() ?? null,
    marketingConsentVersion: user.marketingConsentVersion,
  })
}

/**
 * PATCH /api/mypage/marketing-consent — 마케팅 수신 동의·철회
 * body: { marketing: boolean }
 */
export async function PATCH(req: Request) {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  })
  if (!user || user.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: '이용할 수 없는 계정 상태입니다.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 })
  }
  const marketing = (body as { marketing?: unknown }).marketing === true

  const updated = await prisma.user.update({
    where: { id: userId },
    data: memberMarketingConsentDbFields(marketing),
    select: {
      marketingConsent: true,
      marketingConsentAt: true,
      marketingConsentVersion: true,
    },
  })

  return NextResponse.json({
    ok: true,
    marketingConsent: updated.marketingConsent,
    marketingConsentAt: updated.marketingConsentAt?.toISOString() ?? null,
    marketingConsentVersion: updated.marketingConsentVersion,
  })
}
