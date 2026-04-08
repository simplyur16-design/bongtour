import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyHanatourMonthlyBenefitRescrape } from '@/lib/hanatour-full-sync'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST { benefitMonth?, benefitUrl?, productIds?: string[] }
 * 월별 카드사/제휴 혜택 재수집 + (선택) Product.benefitMonthRef 연결.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: { benefitMonth?: string; benefitUrl?: string; productIds?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  try {
    await applyHanatourMonthlyBenefitRescrape(prisma, body.productIds, {
      benefitMonth: body.benefitMonth,
      benefitUrl: body.benefitUrl,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[hanatour monthly-benefit]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
