/**
 * 공개 상품 상세·관리자 고객 미리보기 공통 Prisma include.
 */
export const PRODUCT_DETAIL_PAGE_INCLUDE = {
  prices: { orderBy: { date: 'asc' as const } },
  departures: { orderBy: { departureDate: 'asc' as const } },
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
