/**
 * Rule A·SD1 공용 — DB `ProductDeparture` 미래 성인가 출발 가드.
 * 라이브 스크래프/API가 0건이어도 DB에 출발이 남아 있으면 "미래 출발 없음" 마커를 붙이지 않는다.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

export type RuleAMarkerLike = {
  noFutureDepartureConfirmedAt: Date | null
  lastFutureDepartureDate: Date | null
  marked: boolean
}

/** KST today(포함) ~ 미래, 성인가 > 0. */
export function futurePricedDepartureWhere(
  productId: string,
  todayYmd: string,
): Prisma.ProductDepartureWhereInput {
  const todayUtc = new Date(`${todayYmd}T00:00:00.000Z`)
  return {
    productId,
    departureDate: { gte: todayUtc },
    adultPrice: { gt: 0 },
  }
}

export async function productHasFuturePricedDeparture(
  prisma: PrismaClient,
  productId: string,
  todayYmd: string,
): Promise<boolean> {
  const n = await prisma.productDeparture.count({
    where: futurePricedDepartureWhere(productId, todayYmd),
  })
  return n > 0
}

export async function maxFuturePricedDepartureDate(
  prisma: PrismaClient,
  productId: string,
  todayYmd: string,
): Promise<Date | null> {
  const row = await prisma.productDeparture.findFirst({
    where: futurePricedDepartureWhere(productId, todayYmd),
    orderBy: { departureDate: 'desc' },
    select: { departureDate: true },
  })
  return row?.departureDate ?? null
}

/** 라이브 0건 + DB 미래 출발 있음 → 마커 해제·DB 최대 출발일 반영. */
export function applyDbFutureDepartureGuardToRuleAMarkers(
  liveMarkers: RuleAMarkerLike,
  dbHasFuturePricedDeparture: boolean,
  dbLastFutureDepartureDate: Date | null,
): RuleAMarkerLike {
  if (!liveMarkers.marked) return liveMarkers
  if (!dbHasFuturePricedDeparture) return liveMarkers
  return {
    noFutureDepartureConfirmedAt: null,
    lastFutureDepartureDate: dbLastFutureDepartureDate,
    marked: false,
  }
}

export async function reconcileRuleAMarkersWithDbFutureDepartures(
  prisma: PrismaClient,
  productId: string,
  todayYmd: string,
  liveMarkers: RuleAMarkerLike,
): Promise<RuleAMarkerLike> {
  if (!liveMarkers.marked) return liveMarkers
  const hasFuture = await productHasFuturePricedDeparture(prisma, productId, todayYmd)
  if (!hasFuture) return liveMarkers
  const lastFuture = await maxFuturePricedDepartureDate(prisma, productId, todayYmd)
  return applyDbFutureDepartureGuardToRuleAMarkers(liveMarkers, true, lastFuture)
}
