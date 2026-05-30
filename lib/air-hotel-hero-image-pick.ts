import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getHomeHubCoverImageUrl } from '@/lib/final-image-selection'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

const CANDIDATE_TAKE = 72

function startOfTodayKst(): Date {
  const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  seoul.setHours(0, 0, 0, 0)
  return seoul
}

/**
 * 자유여행 시즌 히어로 — registered air_hotel_free overseas + 미래 출발일 + cover URL.
 * `home-hub-four-photo-bundle` pickAirHotelCoverUrl 패턴과 동일 (미래 출발 필터 추가).
 */
export async function pickAirHotelSeasonHeroUrl(now: Date = new Date()): Promise<string | null> {
  const nowFloor = startOfTodayKst()
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      listingKind: 'air_hotel_free',
      departures: { some: { departureDate: { gte: nowFloor } } },
      AND: [publicProductWhereClause(now)],
    },
    orderBy: { updatedAt: 'desc' },
    take: CANDIDATE_TAKE,
    select: {
      bgImageUrl: true,
      schedule: true,
      itineraries: {
        select: { day: true, description: true },
        orderBy: { day: 'asc' },
        take: 24,
      },
    },
  })

  for (const p of rows) {
    const scheduleDays = getScheduleFromProduct(p)
    const url = (getHomeHubCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays }) ?? '').trim()
    if (url) return url
  }
  return null
}
