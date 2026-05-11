import { prisma } from '@/lib/prisma'
import { parseCounselingNotes } from '@/lib/parsed-product-types'
import { getPexelsImage } from '@/lib/pexels-service'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

/** Next 15 GET Route Handler 기본 비캐시 대응 — 메인 위젯·Pexels 폴백 호출 완화 */
export const revalidate = 60

/**
 * GET /api/featured
 * 메인 페이지용 대표 상품 1건: 상품명, 첫 출발일, 첫 가격, 상담 안내, 커버 이미지 URL
 */
export async function GET() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        registrationStatus: 'registered',
        AND: [publicProductWhereClause()],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        prices: { orderBy: { date: 'asc' }, take: 1 },
      },
    })

    if (!product) {
      const defaultCover = await getPexelsImage('tropical beach travel')
      return jsonWithLeakGuard(
        {
          title: null,
          departureDate: null,
          priceKrw: null,
          counselingPoints: null,
          coverImageUrl: defaultCover,
        },
        'api.featured.empty',
      )
    }

    const scheduleRows = getScheduleFromProduct({ schedule: product.schedule })
    let coverImageUrl: string = getFinalCoverImageUrl({ bgImageUrl: product.bgImageUrl, scheduleDays: scheduleRows }) ?? ''
    if (!coverImageUrl) coverImageUrl = await getPexelsImage('luxury travel panorama')

    const firstPrice = product.prices.find((p) => isOnOrAfterPublicBookableMinDate(p.date)) ?? null
    const priceAdult = firstPrice ? (firstPrice as { adult?: number }).adult ?? 0 : 0

    const counselingNotes = parseCounselingNotes(product.counselingNotes)
    const counselingPoints = counselingNotes?.counseling_points ?? []

    const payload = {
      productId: product.id,
      title: product.title,
      departureDate: firstPrice
        ? new Date(firstPrice.date).toISOString().slice(0, 10)
        : null,
      priceKrw: firstPrice && priceAdult > 0 ? priceAdult : null,
      counselingPoints: counselingPoints.map((p) => ({
        title: p.title,
        content: p.content,
        script: p.script,
      })),
      coverImageUrl,
    }
    return jsonWithLeakGuard(payload, 'api.featured')
  } catch (e) {
    console.error('[GET /api/featured] Prisma 또는 후처리 실패 — 빈 페이로드로 응답 (UI 유지)', e)
    try {
      const defaultCover = await getPexelsImage('tropical beach travel')
      const fallback = {
        title: null,
        departureDate: null,
        priceKrw: null,
        counselingPoints: null,
        coverImageUrl: defaultCover,
      }
      return jsonWithLeakGuard(fallback, 'api.featured.fallback')
    } catch {
      const fallback = {
        title: null,
        departureDate: null,
        priceKrw: null,
        counselingPoints: null,
        coverImageUrl: '',
      }
      return jsonWithLeakGuard(fallback, 'api.featured.fallback-minimal')
    }
  }
}
