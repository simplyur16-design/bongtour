/**
 * 공개 상품 상세·관리자 고객 미리보기 공통 Prisma include.
 */
import type { Prisma } from '@prisma/client'
import { getPublicBookableMinDate } from '@/lib/public-bookable-date'

/** browse `BROWSE_DEPARTURE_PER_PRODUCT_TAKE`와 동일 상한 — 달력·요금 SSOT */
const DETAIL_DEPARTURE_PER_PRODUCT_TAKE = 100

/**
 * 상세 달력·항공 key facts·공급사 price-row 변환에 필요한 출발 행만 로드.
 * (`product-departure-to-price-rows-*`, `departure-key-facts`, verygood duration)
 */
export function buildProductDetailDepartureSelect() {
  return {
    id: true,
    productId: true,
    departureDate: true,
    adultPrice: true,
    childBedPrice: true,
    childNoBedPrice: true,
    infantPrice: true,
    localPriceText: true,
    statusRaw: true,
    statusLabelsRaw: true,
    seatsStatusRaw: true,
    seatCount: true,
    carrierName: true,
    minPax: true,
    outboundFlightNo: true,
    outboundDepartureAirport: true,
    outboundDepartureAt: true,
    outboundArrivalAirport: true,
    outboundArrivalAt: true,
    inboundFlightNo: true,
    inboundDepartureAirport: true,
    inboundDepartureAt: true,
    inboundArrivalAirport: true,
    inboundArrivalAt: true,
  } satisfies Prisma.ProductDepartureSelect
}

export type ProductDetailDepartureRow = Prisma.ProductDepartureGetPayload<{
  select: ReturnType<typeof buildProductDetailDepartureSelect>
}>

/** ProductDeparture 없을 때만 fallback — `product-detail-view` publicPrices 매핑 필드 */
function buildProductDetailPriceSelect() {
  return {
    id: true,
    productId: true,
    date: true,
    adult: true,
    childBed: true,
    childNoBed: true,
    infant: true,
    localPrice: true,
    priceGap: true,
  } satisfies Prisma.ProductPriceSelect
}

export function buildProductDetailPageInclude(baseDate: Date = new Date()) {
  const minBookable = getPublicBookableMinDate(baseDate)
  return {
    prices: {
      where: { date: { gte: minBookable } },
      orderBy: { date: 'asc' as const },
      select: buildProductDetailPriceSelect(),
    },
    departures: {
      where: { departureDate: { gte: minBookable } },
      orderBy: { departureDate: 'asc' as const },
      select: buildProductDetailDepartureSelect(),
      take: DETAIL_DEPARTURE_PER_PRODUCT_TAKE,
    },
    itineraries: { orderBy: { day: 'asc' as const } },
    itineraryDays: {
      orderBy: { day: 'asc' as const },
      select: {
        id: true,
        day: true,
        city: true,
        hotelText: true,
        breakfastText: true,
        lunchText: true,
        dinnerText: true,
        mealSummaryText: true,
        meals: true,
      },
    },
    optionalTours: true,
    brand: { select: { brandKey: true } },
  } as const
}

/** @deprecated `buildProductDetailPageInclude()` 사용 */
export const PRODUCT_DETAIL_PAGE_INCLUDE = buildProductDetailPageInclude()
