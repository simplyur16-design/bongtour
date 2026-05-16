/**
 * PC 메인 — 시즌 큐레이션 연결 상품 + 동일 도시·국가 등록 상품.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getCachedSeasonLinkedProductIds } from '@/lib/season-curation-content'
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
  cityKey: true,
  countryKey: true,
  schedule: true,
  itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' as const }, take: 24 },
  ...PRODUCT_PRICE_FOR_BROWSE_INCLUDE,
} as const

async function loadSeasonProductGridUncached(): Promise<ResultItem[]> {
  const now = new Date()
  const nowFloor = startOfTodayKst()
  const ids = await getCachedSeasonLinkedProductIds()
  if (ids.length === 0) return []

  const linked = await prisma.product.findMany({
    where: {
      id: { in: ids },
      registrationStatus: 'registered',
      NOT: { travelScope: 'domestic' },
      AND: [publicProductWhereClause(now)],
    },
    select: productSelect,
  })

  const cityKeys = [...new Set(linked.map((p) => p.cityKey).filter((k): k is string => Boolean(k?.trim())))]
  const countryKeys = [...new Set(linked.map((p) => p.countryKey).filter((k): k is string => Boolean(k?.trim())))]
  const linkedIds = new Set(linked.map((p) => p.id))

  const geoOr: { cityKey?: { in: string[] }; countryKey?: { in: string[] } }[] = []
  if (cityKeys.length) geoOr.push({ cityKey: { in: cityKeys } })
  if (countryKeys.length) geoOr.push({ countryKey: { in: countryKeys } })

  let related: typeof linked = []
  if (geoOr.length > 0) {
    related = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        NOT: { travelScope: 'domestic' },
        id: { notIn: [...linkedIds] },
        AND: [{ OR: geoOr }, publicProductWhereClause(now)],
      },
      select: productSelect,
      take: 36,
    })
  }

  const score = (p: (typeof linked)[number]) => {
    const earliest = earliestFutureDeparture(p.departures, nowFloor)
    const price = computeEffectivePricePerPersonKrwFromRow(p)
    return { p, earliest, price }
  }

  const orderedLinked = [...linked].map(score).sort((a, b) => {
    const ta = a.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = b.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return (a.price ?? 1e12) - (b.price ?? 1e12)
  })

  const orderedRelated = [...related].map(score).sort((a, b) => {
    const ta = a.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = b.earliest?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return (a.price ?? 1e12) - (b.price ?? 1e12)
  })

  const merged = [...orderedLinked, ...orderedRelated].slice(0, 12)
  return merged.map(({ p }) => toResultItem(p))
}

export async function getCachedSeasonProductGridItems(): Promise<ResultItem[]> {
  const run = unstable_cache(
    () => loadSeasonProductGridUncached(),
    ['season-product-grid-pc-v1'],
    { revalidate: 21_600 },
  )
  return run()
}
