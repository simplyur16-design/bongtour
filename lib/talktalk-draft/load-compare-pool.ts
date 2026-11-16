/**
 * 등록된 해외 상품만 읽는다. 비교 로더와 같이 메가메뉴 leaf 별칭으로 좁히고, 가격은 출발 행 adultPrice만 가져온다.
 */
import { prisma } from '@/lib/prisma'
import {
  comparePlaceDbSearchTerms,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'
import type { TalktalkCompareProductInput } from '@/lib/talktalk-draft/compare-candidates'

export async function loadTalktalkCompareProducts(input: {
  destination: string
  baseDate?: Date
}): Promise<TalktalkCompareProductInput[]> {
  const place = resolveComparePlaceCluster({ placeQuery: input.destination })
  if (!place) return []
  const terms = comparePlaceDbSearchTerms(place)
  if (terms.length === 0) return []
  const baseDate = input.baseDate ?? new Date()
  const placeOr = terms.flatMap((t) => [
    { primaryDestination: { contains: t } },
    { destination: { contains: t } },
    { title: { contains: t } },
  ])
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      OR: placeOr,
    },
    take: 400,
    select: {
      id: true,
      slug: true,
      title: true,
      duration: true,
      tripNights: true,
      tripDays: true,
      primaryDestination: true,
      destination: true,
      originSource: true,
      departures: {
        where: { departureDate: { gte: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000) } },
        select: {
          id: true,
          adultPrice: true,
          departureDate: true,
          statusRaw: true,
          seatsStatusRaw: true,
          seatCount: true,
          isBookable: true,
        },
        orderBy: { departureDate: 'asc' },
        take: 160,
      },
    },
  })
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    duration: p.duration,
    tripNights: p.tripNights,
    tripDays: p.tripDays,
    primaryDestination: p.primaryDestination,
    destination: p.destination,
    originSource: p.originSource,
    departures: p.departures,
  }))
}
