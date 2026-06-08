import type { PrismaClient } from '@prisma/client'
import {
  isEligibleForSixMonthNoPriceProductPurge,
  resolveSixMonthCalendarVerificationMarker,
  seoulHorizonYmdFromToday,
  type SixMonthVerificationMarkerSource,
} from '@/lib/product-six-month-price-verification'
import { seoulCalendarYmd } from '@/lib/scraper-schedule-strategy'

export type SixMonthNoPricePurgeCandidate = {
  id: string
  title: string
  slug: string | null
  originSource: string | null
  registrationStatus: string | null
  markerSources: SixMonthVerificationMarkerSource[]
  calendarBatchRetired: boolean
  noFutureDepartureConfirmedAt: string | null
  bookingCount: number
  todaySeoulYmd: string
  horizonYmd: string
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

/** 마커가 있는 등록·자동비공개 상품 중 6개월 창에 성인가 없는 후보 조회. */
export async function findSixMonthNoPricePurgeCandidates(
  prisma: PrismaClient,
  options?: { todaySeoulYmd?: string; limit?: number },
): Promise<SixMonthNoPricePurgeCandidate[]> {
  const todaySeoulYmd = options?.todaySeoulYmd ?? seoulCalendarYmd()
  const horizonYmd = seoulHorizonYmdFromToday(todaySeoulYmd)
  const limit = Math.max(1, Math.min(500, options?.limit ?? 200))

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: { in: ['registered', 'auto_unpublished'] },
      OR: [
        { noFutureDepartureConfirmedAt: { not: null } },
        { rawMeta: { contains: '"calendarBatchRetired":true' } },
        { rawMeta: { contains: '"calendarBatchRetired": true' } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit * 3,
    select: {
      id: true,
      title: true,
      slug: true,
      originSource: true,
      registrationStatus: true,
      rawMeta: true,
      noFutureDepartureConfirmedAt: true,
    },
  })

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const bookingGroups =
    ids.length > 0
      ? await prisma.booking.groupBy({
          by: ['productId'],
          where: { productId: { in: ids } },
          _count: { id: true },
        })
      : []
  const bookingCountByProduct = new Map(bookingGroups.map((g) => [g.productId, g._count.id]))
  const pricedInWindow = await prisma.productDeparture.findMany({
    where: {
      productId: { in: ids },
      departureDate: {
        gte: ymdToUtcMidnight(todaySeoulYmd),
        lte: ymdToUtcMidnight(horizonYmd),
      },
      adultPrice: { gt: 0 },
    },
    select: { productId: true },
    distinct: ['productId'],
  })
  const pricedProductIds = new Set(pricedInWindow.map((r) => r.productId))

  const out: SixMonthNoPricePurgeCandidate[] = []
  for (const row of rows) {
    if (pricedProductIds.has(row.id)) continue
    const marker = resolveSixMonthCalendarVerificationMarker(row)
    if (!marker.verified) continue
    const check = isEligibleForSixMonthNoPriceProductPurge({
      product: row,
      departures: [],
      todaySeoulYmd,
    })
    if (!check.eligible) continue
    out.push({
      id: row.id,
      title: row.title,
      slug: row.slug,
      originSource: row.originSource,
      registrationStatus: row.registrationStatus,
      markerSources: marker.sources,
      calendarBatchRetired: marker.sources.includes('calendar_batch_retired'),
      noFutureDepartureConfirmedAt: row.noFutureDepartureConfirmedAt?.toISOString() ?? null,
      bookingCount: bookingCountByProduct.get(row.id) ?? 0,
      todaySeoulYmd,
      horizonYmd: check.horizonYmd,
    })
    if (out.length >= limit) break
  }
  return out
}

export type PurgeSixMonthNoPriceProductResult =
  | { status: 'deleted'; productId: string }
  | { status: 'skipped_bookings'; productId: string; bookingCount: number }
  | { status: 'not_found'; productId: string }

/** 예약 연결 시 삭제하지 않음. cascade 로 출발·가격·일정 등 제거. */
export async function purgeSixMonthNoPriceProduct(
  prisma: PrismaClient,
  productId: string,
): Promise<PurgeSixMonthNoPriceProductResult> {
  const exists = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!exists) return { status: 'not_found', productId }

  const bookingCount = await prisma.booking.count({ where: { productId } })
  if (bookingCount > 0) {
    return { status: 'skipped_bookings', productId, bookingCount }
  }

  await prisma.$transaction(async (tx) => {
    await tx.scraperQueue.deleteMany({ where: { productId } })
    await tx.agentScrapeReport.updateMany({
      where: { productId },
      data: { productId: null },
    })
    await tx.product.delete({ where: { id: productId } })
  })

  return { status: 'deleted', productId }
}
