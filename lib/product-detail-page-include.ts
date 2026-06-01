/**
 * 공개 상품 상세·관리자 고객 미리보기 공통 Prisma select.
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

function buildProductDetailItinerarySelect() {
  return {
    id: true,
    day: true,
    description: true,
  } satisfies Prisma.ItinerarySelect
}

function buildProductDetailOptionalTourSelect() {
  return {
    id: true,
    name: true,
    priceUsd: true,
    duration: true,
    waitPlaceIfNotJoined: true,
  } satisfies Prisma.OptionalTourSelect
}

/** 상세 UI·직렬화에 쓰는 Product 스칼라 — browse 파생·운영 메타·미사용 대용량 TEXT 제외 */
export function buildProductDetailScalarsSelect() {
  return {
    id: true,
    registrationStatus: true,
    originSource: true,
    originCode: true,
    title: true,
    destination: true,
    primaryDestination: true,
    primaryRegion: true,
    duration: true,
    airline: true,
    productType: true,
    listingKind: true,
    airportTransferType: true,
    travelScope: true,
    bgImageUrl: true,
    bgImageSource: true,
    bgImageIsGenerated: true,
    bgImagePhotographer: true,
    bgImagePlaceName: true,
    bgImageRehostSearchLabel: true,
    publicImageHeroSeoKeywordsJson: true,
    publicImageHeroSeoLine: true,
    rawMeta: true,
    counselingNotes: true,
    schedule: true,
    includedText: true,
    excludedText: true,
    criticalExclusions: true,
    shoppingShopOptions: true,
    shoppingVisitCountTotal: true,
    shoppingCustomsNoticeRaw: true,
    shoppingCount: true,
    shoppingItems: true,
    optionalToursStructured: true,
    hasOptionalTours: true,
    priceFrom: true,
    priceCurrency: true,
    benefitSummary: true,
    highlightPoints: true,
    highlightPointsRaw: true,
    promotionLabelsRaw: true,
    hotelSummaryRaw: true,
    hotelSummaryText: true,
    airtelHotelInfoJson: true,
    reservationNoticeRaw: true,
    minimumDepartureCount: true,
    minimumDepartureText: true,
    isDepartureGuaranteed: true,
    currentBookedCount: true,
    departureStatusText: true,
    mandatoryLocalFee: true,
    mandatoryCurrency: true,
    flightAdminJson: true,
    publicDetailPayloadJson: true,
    publicDetailPayloadBuiltAt: true,
  } satisfies Prisma.ProductSelect
}

export function buildProductDetailPageSelect(baseDate: Date = new Date()) {
  const minBookable = getPublicBookableMinDate(baseDate)
  return {
    ...buildProductDetailScalarsSelect(),
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
    itineraries: {
      orderBy: { day: 'asc' as const },
      select: buildProductDetailItinerarySelect(),
    },
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
    optionalTours: {
      select: buildProductDetailOptionalTourSelect(),
    },
    brand: { select: { brandKey: true } },
  } satisfies Prisma.ProductSelect
}

export type ProductDetailPageRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof buildProductDetailPageSelect>
}>

/**
 * @deprecated `buildProductDetailPageSelect()` — `include`는 Product 전 컬럼을 로드함.
 * 관계 필터만 동일; 스칼라 push-down 없음.
 */
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
