/**
 * 상품 목록 browse 전용 — 필터(출발확정·항공시간·요일·현지옵션 등)에 필요한 필드까지 포함.
 * 인당 가격 계산은 `adultPrice`·`departureDate`만 필수이며 나머지는 필터 전용.
 */
import type { Prisma } from '@prisma/client'
import { getPublicBookableMinDate } from '@/lib/public-bookable-date'

/** browse `findMany` include — 과거 출발·과다 take 제외로 DB 부하 절감 */
export function buildProductBrowseFullInclude(baseDate: Date = new Date()) {
  const minDeparture = getPublicBookableMinDate(baseDate)
  return {
    departures: {
      where: { departureDate: { gte: minDeparture } },
      orderBy: { departureDate: 'asc' as const },
      select: {
        adultPrice: true,
        baselineAdultPrice: true,
        departureDate: true,
        minPax: true,
        outboundDepartureAt: true,
        carrierName: true,
      },
      take: 100,
    },
    brand: {
      select: { brandKey: true, displayName: true },
    },
    countryTags: {
      select: {
        countryKey: true,
        nodeKey: true,
      },
    },
    /** I-4: 다도시 태그 OR */
    cityTags: {
      select: { cityKey: true },
    },
  } as const
}

/** @deprecated `buildProductBrowseFullInclude()` 사용 */
export const PRODUCT_BROWSE_FULL_INCLUDE = buildProductBrowseFullInclude()

export type ProductBrowseIncludedRow = Prisma.ProductGetPayload<{
  include: ReturnType<typeof buildProductBrowseFullInclude>
}>
