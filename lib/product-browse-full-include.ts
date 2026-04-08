/**
 * 상품 목록 browse 전용 — 필터(출발확정·항공시간·요일·현지옵션 등)에 필요한 필드까지 포함.
 * 인당 가격 계산은 `adultPrice`·`departureDate`만 필수이며 나머지는 필터 전용.
 */
export const PRODUCT_BROWSE_FULL_INCLUDE = {
  departures: {
    orderBy: { departureDate: 'asc' as const },
    select: {
      adultPrice: true,
      departureDate: true,
      minPax: true,
      outboundDepartureAt: true,
      carrierName: true,
      isDepartureConfirmed: true,
      statusLabelsRaw: true,
      statusRaw: true,
    },
    take: 120,
  },
  prices: {
    select: { adult: true },
    take: 40,
    orderBy: { date: 'asc' as const },
  },
  brand: {
    select: { brandKey: true, displayName: true },
  },
  _count: {
    select: { optionalTours: true },
  },
} as const
