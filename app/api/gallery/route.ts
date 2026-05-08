import { prisma } from '@/lib/prisma'
import { getPexelsImage } from '@/lib/pexels-service'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { LUXURY_FALLBACK_IMAGE_URL } from '@/lib/image-fallback'

/** 갤러리 한 요청당 Pexels 검색 상한 — 초과 분은 로컬 럭셔리 폴백 URL과 동일 처리(getPexelsImage 실패 경로와 정합) */
const GALLERY_PEXELS_MAX_FETCHES = 12

const galleryProductDbSelect = {
  id: true,
  title: true,
  originSource: true,
  bgImageSource: true,
  bgImageIsGenerated: true,
  primaryDestination: true,
  destinationRaw: true,
  destination: true,
  primaryRegion: true,
  themeTags: true,
  displayCategory: true,
  includedText: true,
  publicImageHeroSeoLine: true,
  publicImageHeroSeoKeywordsJson: true,
  bgImageUrl: true,
  schedule: true,
  prices: {
    select: { date: true, adult: true },
    orderBy: { date: 'asc' as const },
    take: 40,
  },
  itineraries: {
    select: { day: true, description: true },
    orderBy: { day: 'asc' as const },
  },
} as const

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
  /** 운영 노출 메타 — 국내 특별테마 등 */
  displayCategory: string | null
  /** 포함 내역(앞부분만 갤러리 필터 보조) */
  includedText: string | null
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
        select: galleryProductDbSelect,
      }),
      prisma.product.count({ where: { registrationStatus: 'registered' } }),
    ])

    const defaultKeyword = 'luxury travel panorama'

    type GalleryRow = (typeof products)[number]

    const intermediates = products.map((p: GalleryRow) => {
      const publicPrices = p.prices.filter((pp) => isOnOrAfterPublicBookableMinDate(pp.date))
      const firstBookable = publicPrices.find((pp) => pp.adult > 0)
      const firstPrice = firstBookable ?? publicPrices[0]
      const scheduleRows = getScheduleFromProduct({ schedule: p.schedule, itineraries: p.itineraries })
      const scheduleLength = scheduleRows.length
      const scheduleImages = scheduleRows.map((e) => e.imageUrl).filter((url): url is string => Boolean(url))
      const dayCount = scheduleLength > 0 ? scheduleLength : p.itineraries.length
      const duration = dayCount > 0 ? `${dayCount}일` : '—'
      const coverFromAssets = getFinalCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays: scheduleRows }) ?? ''

      return {
        p,
        firstBookable,
        firstPrice,
        scheduleRows,
        scheduleImages,
        duration,
        coverFromAssets,
      }
    })

    const needPexelsIdx = intermediates
      .map((row, i) => (!row.coverFromAssets ? i : -1))
      .filter((i): i is number => i >= 0)
    const pexelsFetchIdx = needPexelsIdx.slice(0, GALLERY_PEXELS_MAX_FETCHES)
    const pexelsUrls =
      pexelsFetchIdx.length > 0
        ? await Promise.all(pexelsFetchIdx.map(() => getPexelsImage(defaultKeyword)))
        : []
    const pexelsUrlByRowIndex = new Map<number, string>()
    pexelsFetchIdx.forEach((idx, j) => {
      const u = pexelsUrls[j]
      if (u) pexelsUrlByRowIndex.set(idx, u)
    })

    const items: GalleryProduct[] = intermediates.map((row, i) => {
      const { p, firstBookable, firstPrice, scheduleImages, duration, coverFromAssets } = row
      let coverImageUrl = coverFromAssets
      if (!coverImageUrl) {
        coverImageUrl = pexelsUrlByRowIndex.get(i) ?? LUXURY_FALLBACK_IMAGE_URL
      }

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
        displayCategory: p.displayCategory ?? null,
        includedText: p.includedText ? String(p.includedText).slice(0, 2000) : null,
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

    const payload = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
    return jsonWithLeakGuard(payload, 'api.gallery')
  } catch (e) {
    console.error('[GET /api/gallery]', e)
    return jsonWithLeakGuard(
      {
        items: [],
        total: 0,
        page: 1,
        limit: 6,
        totalPages: 0,
      },
      'api.gallery.fallback',
    )
  }
}
