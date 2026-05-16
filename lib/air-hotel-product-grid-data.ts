/**
 * 메인 — 항공+호텔(자유여행) 등록 상품.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { computeEffectivePricePerPersonKrwFromRow, PRODUCT_PRICE_FOR_BROWSE_INCLUDE } from '@/lib/product-price-per-person'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import type { ResultItem } from '@/components/products/ProductResultsList'

function startOfTodayKst(): Date {
  const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  seoul.setHours(0, 0, 0, 0)
  return seoul
}

function earliestFutureDeparture(departures: { departureDate: Date }[], nowFloor: Date): Date | null {
  let min: number | null = null
  for (const d of departures) {
    const t = d.departureDate.getTime()
    if (t < nowFloor.getTime()) continue
    if (min == null || t < min) min = t
  }
  return min == null ? null : new Date(min)
}

function toResultItem(p: {
  id: string
  title: string
  originSource: string
  productType: string | null
  listingKind: string | null
  airportTransferType: string | null
  primaryDestination: string | null
  primaryRegion: string | null
  duration: string | null
  bgImageUrl: string | null
  schedule: string | null
  itineraries: { day: number; description: string }[]
  departures: { adultPrice: number | null; departureDate: Date }[]
  prices: { adult: number }[]
  priceFrom: number | null
}): ResultItem {
  const scheduleRows = getScheduleFromProduct(p as Parameters<typeof getScheduleFromProduct>[0])
  const coverUrl = getFinalCoverImageUrl({
    bgImageUrl: p.bgImageUrl,
    scheduleDays: scheduleRows,
  })
  return {
    id: p.id,
    title: p.title,
    originSource: p.originSource,
    productType: p.productType,
    listingKind: p.listingKind ?? null,
    airportTransferType: p.airportTransferType,
    primaryDestination: p.primaryDestination,
    primaryRegion: p.primaryRegion,
    duration: p.duration,
    bgImageUrl: p.bgImageUrl,
    coverImageUrl: coverUrl,
    effectivePricePerPersonKrw: computeEffectivePricePerPersonKrwFromRow(p),
  }
}

const productSelect = {
  id: true,
  title: true,
  originSource: true,
  productType: true,
  listingKind: true,
  airportTransferType: true,
  primaryDestination: true,
  primaryRegion: true,
  duration: true,
  bgImageUrl: true,
  priceFrom: true,
  schedule: true,
  itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' as const }, take: 24 },
  ...PRODUCT_PRICE_FOR_BROWSE_INCLUDE,
} as const

async function loadAirHotelGridUncached(): Promise<ResultItem[]> {
  const now = new Date()
  const nowFloor = startOfTodayKst()
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      listingKind: 'air_hotel_free',
      NOT: { travelScope: 'domestic' },
      AND: [publicProductWhereClause(now)],
    },
    select: productSelect,
    take: 40,
  })

  const scored = rows.map((p) => ({
    p,
    earliest: earliestFutureDeparture(p.departures, nowFloor),
    price: computeEffectivePricePerPersonKrwFromRow(p),
  }))

  scored.sort((a, b) => {
    const ta = a.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = b.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return (a.price ?? 1e12) - (b.price ?? 1e12)
  })

  return scored.slice(0, 12).map(({ p }) => toResultItem(p))
}

export async function getCachedAirHotelProductGridItems(): Promise<ResultItem[]> {
  const run = unstable_cache(() => loadAirHotelGridUncached(), ['air-hotel-product-grid-main-v1'], {
    revalidate: 21_600,
  })
  return run()
}
