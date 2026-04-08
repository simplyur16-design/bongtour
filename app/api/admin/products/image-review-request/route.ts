import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const KNOWN_SOURCES = new Set([
  'pexels',
  'gemini',
  'manual',
  'destination-set',
  'photopool',
  'city-asset',
  'attraction-asset',
])

/**
 * POST /api/admin/products/image-review-request
 * 선택 상품 중 legacy(대표 이미지 있으나 출처 메타 없음)인 것만 이미지 보강 검수 대상으로 등록.
 * Body: { productIds: string[] }
 * Returns: { ok: true, added: number, skipped: number } | { error }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as { productIds?: unknown }
    const raw = body?.productIds
    const productIds = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'productIds 배열이 필요합니다.' }, { status: 400 })
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        bgImageUrl: true,
        bgImageSource: true,
      },
    })

    const now = new Date()
    let added = 0
    for (const p of products) {
      const hasImage = !!p.bgImageUrl
      const rawSource = (p.bgImageSource ?? '').trim().toLowerCase()
      const isLegacy = hasImage && (!rawSource || !KNOWN_SOURCES.has(rawSource))
      if (!isLegacy) continue
      await prisma.product.update({
        where: { id: p.id },
        data: {
          needsImageReview: true,
          imageReviewRequestedAt: now,
        },
      })
      added += 1
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped: productIds.length - added,
    })
  } catch (e) {
    console.error('image-review-request:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
