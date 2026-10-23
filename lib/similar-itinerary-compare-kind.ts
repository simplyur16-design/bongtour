/**
 * 비슷한 일정 비교 — 패키지 vs 자유여행 kind SSOT.
 * REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: 혼입 금지 — manifest
 */
import type { Prisma } from '@prisma/client'
import {
  AIR_HOTEL_LISTING_KIND,
  AIR_HOTEL_PRODUCT_TYPE,
  isAirHotelProduct,
} from '@/lib/air-hotel-product-ssot'
import type { SimilarItineraryCompareKind } from '@/lib/similar-itinerary-compare-href'

const AIR_HOTEL_PRODUCT_TYPE_WHERE = [
  AIR_HOTEL_PRODUCT_TYPE,
  'airtel',
  'air-tel',
  'air tel',
  'air_hotel',
] as const

/** DB·메모리 공통 — FIT 판정 (listingKind/productType + fit- 슬러그) */
export function isSimilarItineraryCompareFitProduct(p: {
  listingKind?: string | null
  productType?: string | null
  slug?: string | null
}): boolean {
  if (String(p.slug || '')
    .trim()
    .toLowerCase()
    .startsWith('fit-')) {
    return true
  }
  return isAirHotelProduct(p)
}

export function productMatchesSimilarItineraryCompareKind(
  p: {
    listingKind?: string | null
    productType?: string | null
    slug?: string | null
  },
  kind: SimilarItineraryCompareKind,
): boolean {
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: 패키지 표에 FIT 금지·반대도 금지 — manifest
  const isFit = isSimilarItineraryCompareFitProduct(p)
  return kind === 'fit' ? isFit : !isFit
}

/** findMany where push-down — take 전에 kind 적용 (패키지 풀이 FIT를 밀어내지 않게) */
export function prismaWhereForSimilarItineraryCompareKind(
  kind: SimilarItineraryCompareKind,
): Prisma.ProductWhereInput {
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: DB where kind push-down — manifest
  const fitOr: Prisma.ProductWhereInput[] = [
    { listingKind: AIR_HOTEL_LISTING_KIND },
    { productType: { in: [...AIR_HOTEL_PRODUCT_TYPE_WHERE] } },
    { slug: { startsWith: 'fit-' } },
  ]
  if (kind === 'fit') {
    return { OR: fitOr }
  }
  return { NOT: { OR: fitOr } }
}

export function similarItineraryCompareKindLabel(kind: SimilarItineraryCompareKind): string {
  return kind === 'fit' ? '자유여행' : '해외 패키지'
}

export function similarItineraryCompareDisclaimer(kind: SimilarItineraryCompareKind): string {
  const slice = similarItineraryCompareKindLabel(kind)
  return `동일한 상품이 아닙니다. ${slice} 등록 상품만 · 비슷한 지역·박일 후보를 나란히 둔 사실 표입니다. 패키지와 자유여행은 섞지 않습니다. 우열·추천 문구는 없습니다. 빈 필드는 「정보 없음」이며 「없음」(확인된 0/false)과 구분합니다.`
}
