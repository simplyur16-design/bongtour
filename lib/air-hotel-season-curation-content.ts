/**
 * /travel/air-hotel 시즌 큐레이션 read layer — 6h 캐시.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { computeEffectivePricePerPersonKrwFromRow, PRODUCT_PRICE_FOR_BROWSE_INCLUDE } from '@/lib/product-price-per-person'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { getAirHotelCycleIdForNow } from '@/lib/air-hotel-season-curation-constants'

export type AirHotelSeasonCurationDTO = {
  cycleId: string
  monthlyMessages: Record<string, string>
  heroImageUrl: string | null
  monthlyProducts: Record<string, ResultItem[]>
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

function parseLinkedProductIds(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue
    const ids = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    if (ids.length) out[k] = ids
  }
  return out
}

function parseMonthlyMessages(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

async function loadAirHotelSeasonCurationUncached(): Promise<AirHotelSeasonCurationDTO | null> {
  const now = new Date()
  const cycleId = getAirHotelCycleIdForNow(now)
  const row = await prisma.airHotelSeasonCuration.findFirst({
    where: { cycleId, isPublished: true },
  })
  if (!row) return null

  const monthlyMessages = parseMonthlyMessages(row.monthlyMessages)
  const linkedMap = parseLinkedProductIds(row.linkedProductIds)
  const allIds = [...new Set(Object.values(linkedMap).flat())]
  if (allIds.length === 0) {
    return {
      cycleId: row.cycleId,
      monthlyMessages,
      heroImageUrl: row.heroImageUrl,
      monthlyProducts: {},
    }
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: allIds },
      registrationStatus: 'registered',
      AND: [publicProductWhereClause(now)],
    },
    select: productSelect,
  })
  const byId = new Map(products.map((p) => [p.id, toResultItem(p)]))

  const monthlyProducts: Record<string, ResultItem[]> = {}
  for (const [monthKey, ids] of Object.entries(linkedMap)) {
    monthlyProducts[monthKey] = ids.map((id) => byId.get(id)).filter((x): x is ResultItem => Boolean(x))
  }

  return {
    cycleId: row.cycleId,
    monthlyMessages,
    heroImageUrl: row.heroImageUrl,
    monthlyProducts,
  }
}

export async function getCachedAirHotelSeasonCuration(): Promise<AirHotelSeasonCurationDTO | null> {
  const run = unstable_cache(
    () => loadAirHotelSeasonCurationUncached(),
    ['air-hotel-season-curation-v2'],
    { revalidate: 21_600, tags: ['air-hotel-season'] },
  )
  return run()
}
