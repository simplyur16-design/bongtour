import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPexelsImage } from '@/lib/pexels-service'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'

/** `request.url` 사용 — 정적 사전 렌더 시 Dynamic server usage 경고 방지 */
export const dynamic = 'force-dynamic'

export type GalleryProduct = {
  id: string
  title: string
  originSource: string
  bgImageSource: string | null
  bgImageIsGenerated: boolean
  /** 운영 정규화 목적지 — 해외 랜딩·트리 매칭 1순위 */
  primaryDestination: string | null
  /** 공급사 원문 목적지 */
  destinationRaw: string | null
  /** 레거시 목적지 필드 */
  destination: string | null
  /** 운영 1차 권역 메타 (있으면 매칭 보조) */
  primaryRegion: string | null
  /** 쉼표 구분 테마 태그 — 국내 테마 칩 매칭 보조 */
  themeTags: string | null
  /** 등록 시 저장한 대표 이미지 좌측 SEO 한 줄 */
  publicImageHeroSeoLine: string | null
  /** 등록 시 저장한 대표 이미지 SEO 키워드 JSON 배열 */
  publicImageHeroSeoKeywordsJson: string | null
  departureDate: string | null
  duration: string
  priceKrw: number | null
  /** 메인용 커버 (첫 장, 폴백용) */
  coverImageUrl: string
  /** 일정 순서대로 세트 (메인 1 + 일정 4). 사용자 메인 화면에 이 순서로 표시 */
  imageSet: string[]
}

/**
 * GET /api/gallery?page=1&limit=6
 * 메인 갤러리용 상품 목록: 출발일, 기간(일차 수), 성인 최저가, 커버 이미지
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(48, Math.max(6, parseInt(searchParams.get('limit') ?? '6', 10)))
    const offset = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { registrationStatus: 'registered' },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          prices: { orderBy: { date: 'asc' }, take: 40 },
          itineraries: { orderBy: { day: 'asc' } },
        },
      }),
      prisma.product.count({ where: { registrationStatus: 'registered' } }),
    ])

    const defaultKeyword = 'luxury travel panorama'
    const items: GalleryProduct[] = await Promise.all(
      products.map(async (p) => {
        const publicPrices = p.prices.filter((pp) => isOnOrAfterPublicBookableMinDate(pp.date))
        const firstBookable = publicPrices.find((pp) => pp.adult > 0)
        const firstPrice = firstBookable ?? publicPrices[0]
        const scheduleRows = getScheduleFromProduct({ schedule: p.schedule, itineraries: p.itineraries })
        const scheduleLength = scheduleRows.length
        const scheduleImages = scheduleRows.map((e) => e.imageUrl).filter((url): url is string => Boolean(url))
        const dayCount = scheduleLength > 0 ? scheduleLength : p.itineraries.length
        const duration = dayCount > 0 ? `${dayCount}일` : '—'
        // 대표 이미지 우선순위: 1) 관리자/저장 bgImageUrl 2) 일정 첫 장 3) placeholder
        let coverImageUrl = getFinalCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays: scheduleRows }) ?? ''
        if (!coverImageUrl) coverImageUrl = await getPexelsImage(defaultKeyword)
        const imageSet =
          p.bgImageUrl && scheduleImages.length > 0
            ? [p.bgImageUrl, ...scheduleImages]
            : p.bgImageUrl
              ? [p.bgImageUrl]
              : scheduleImages.length > 0
                ? scheduleImages
                : [coverImageUrl]

        return {
          id: p.id,
          title: p.title,
          originSource: p.originSource,
          bgImageSource: p.bgImageSource ?? null,
          bgImageIsGenerated: p.bgImageIsGenerated ?? false,
          primaryDestination: p.primaryDestination ?? null,
          destinationRaw: p.destinationRaw ?? null,
          destination: p.destination ?? null,
          primaryRegion: p.primaryRegion ?? null,
          themeTags: p.themeTags ?? null,
          publicImageHeroSeoLine: p.publicImageHeroSeoLine ?? null,
          publicImageHeroSeoKeywordsJson: p.publicImageHeroSeoKeywordsJson ?? null,
          departureDate: firstBookable
            ? new Date(firstBookable.date).toISOString().slice(0, 10)
            : firstPrice
              ? new Date(firstPrice.date).toISOString().slice(0, 10)
              : null,
          duration,
          priceKrw: firstBookable ? firstBookable.adult : null,
          coverImageUrl,
          imageSet,
        }
      })
    )

    const payload = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
    assertNoInternalMetaLeak(payload, '/api/gallery')
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[GET /api/gallery]', e)
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      limit: 6,
      totalPages: 0,
    })
  }
}
