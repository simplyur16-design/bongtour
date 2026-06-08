import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { findSixMonthNoPricePurgeCandidates } from '@/lib/product-six-month-price-purge'

/**
 * GET /api/admin/products/six-month-purge-recommendations
 * E2E·스크래퍼 6개월 검증 마커가 있고 향후 180일 성인가가 없는 상품 — 삭제 권고 목록.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const limitRaw = Number(new URL(request.url).searchParams.get('limit') ?? '200')
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.trunc(limitRaw))) : 200

    const items = await findSixMonthNoPricePurgeCandidates(prisma, { limit })

    return NextResponse.json({
      items,
      total: items.length,
      policy: {
        horizonDays: 180,
        requiresVerificationMarker: true,
        markerKinds: ['calendar_batch_retired', 'no_future_departure_confirmed'],
      },
    })
  } catch (e) {
    console.error('[GET /api/admin/products/six-month-purge-recommendations]', e)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
