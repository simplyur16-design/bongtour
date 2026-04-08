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
 * - mode 생략 또는 `legacy`: 대표 이미지는 있으나 출처가 legacy 인 상품만 보강 대상 등록 (기존 동작)
 * - mode `manual`: 선택한 상품 전부 보강 대상. 이미 대상이면 `imageReviewRequestedAt`만 갱신(재요청·단건 클릭 가능)
 * Body: { productIds: string[], mode?: 'legacy' | 'manual' }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as { productIds?: unknown; mode?: unknown }
    const raw = body?.productIds
    const productIds = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'productIds 배열이 필요합니다.' }, { status: 400 })
    }

    const mode = body?.mode === 'manual' ? 'manual' : 'legacy'

    if (mode === 'manual') {
      const now = new Date()
      let added = 0
      let refreshed = 0
      const found = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, needsImageReview: true },
      })
      const foundIds = new Set(found.map((p) => p.id))
      const notFound = productIds.filter((id) => !foundIds.has(id)).length
      for (const p of found) {
        if (p.needsImageReview) {
          await prisma.product.update({
            where: { id: p.id },
            data: { imageReviewRequestedAt: now },
          })
          refreshed += 1
          continue
        }
        await prisma.product.update({
          where: { id: p.id },
          data: { needsImageReview: true, imageReviewRequestedAt: now },
        })
        added += 1
      }
      return NextResponse.json({
        ok: true,
        mode: 'manual' as const,
        added,
        refreshed,
        notFound,
      })
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
      mode: 'legacy' as const,
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
