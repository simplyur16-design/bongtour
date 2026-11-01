/**
 * 등록(공개) 전 확인 — 향후 출발일 수, 자유여행 추천일정 일차 수. 읽기만 한다.
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 공개 게이트 입력 — manifest
 */
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
import { resolveFitTotalDays } from '@/lib/fit-itinerary-total-days'
import { futureDepartureWhere } from '@/lib/product-future-departure'

export type RegisterPublishFacts = {
  futureDepartureCount: number
  fitItinerary?: { masterDays: number; requiredDays: number | null }
}

export async function loadRegisterPublishFacts(
  productId: string,
  p: {
    listingKind?: string | null
    productType?: string | null
    duration?: string | null
    title?: string | null
    schedule?: string | null
  },
): Promise<RegisterPublishFacts> {
  const { prisma } = await import('@/lib/prisma')
  const futureDepartureCount = await prisma.productDeparture.count({
    where: { productId, ...futureDepartureWhere() },
  })
  if (!isAirHotelFitItineraryProduct(p)) return { futureDepartureCount }
  const [master, itineraryDayCount] = await Promise.all([
    prisma.fitItineraryMaster.findUnique({
      where: { productId },
      select: { _count: { select: { days: true } } },
    }),
    prisma.itineraryDay.count({ where: { productId } }),
  ])
  const required = resolveFitTotalDays({
    duration: p.duration,
    title: p.title,
    itineraryDayCount,
    schedule: p.schedule,
  })
  return {
    futureDepartureCount,
    fitItinerary: { masterDays: master?._count.days ?? 0, requiredDays: required?.days ?? null },
  }
}
