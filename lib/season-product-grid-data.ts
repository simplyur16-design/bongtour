/**
 * PC 메인 — 시즌 큐레이션 연결 상품 + 동일 도시·국가 등록 상품.
 */
import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getCachedSeasonLinkedProductIds } from '@/lib/season-curation-content'
import { computeEffectivePricePerPersonKrwFromRow, PRODUCT_PRICE_FOR_BROWSE_INCLUDE } from '@/lib/product-price-per-person'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { readCachedArrayOrBypassEmpty } from '@/lib/unstable-cache-empty-bypass'
import { resolvePublicBrowseCardTitle } from '@/lib/bongtour-product-display-title-ssot'
import { applyLocalDepartureDisplayPrefix, resolveDisplayLocalDepartureTags } from '@/lib/local-departure-display-prefix'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'
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
  cityKey: string | null
  countryKey: string | null
  departures: { adultPrice: number | null; departureDate: Date }[]
  prices: { adult: number }[]
  priceFrom: number | null
  localDepartureTag: string[]
  departureAirportLabel: string | null
}): ResultItem {
  // REGRESSION-FREEZE[home-season-grid-no-itinerary-join]: schedule JSON SSOT — manifest
  const scheduleRows = getScheduleFromProduct(p as Parameters<typeof getScheduleFromProduct>[0])
  const coverUrl = getFinalCoverImageUrl({
    bgImageUrl: p.bgImageUrl,
    scheduleDays: scheduleRows,
  })
  // REGRESSION-FREEZE[public-card-hero-short-title]: 시즌 홈 카드 — 짧은 제목 — manifest
  // REGRESSION-FREEZE[public-card-no-kr-departure-place]: 시즌 카드 출발허브≠place — manifest
  const planB = normalizeSupplierRegisterListingTitle(p.title) || p.title
  const card = resolvePublicBrowseCardTitle(
    {
      title: p.title,
      duration: p.duration,
      primaryDestination: p.primaryDestination,
      primaryRegion: p.primaryRegion,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    },
    planB,
  )
  return {
    id: p.id,
    // REGRESSION-FREEZE[local-departure-display-prefix]: 지방출발 머리말(태그 SSOT, 제목 추론 금지) — manifest
    title: applyLocalDepartureDisplayPrefix(card.cardTitle, resolveDisplayLocalDepartureTags(p)),
    heroSubtitle: card.heroSubtitle,
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
  localDepartureTag: true,
  departureAirportLabel: true,
  // REGRESSION-FREEZE[home-season-grid-no-itinerary-join]: schedule JSON만 — itineraries N+1 금지 — manifest
  schedule: true,
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
      travelScope: 'overseas',
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
        travelScope: 'overseas',
        id: { notIn: [...linkedIds] },
        AND: [{ OR: geoOr }, publicProductWhereClause(now)],
      },
      select: productSelect,
      // REGRESSION-FREEZE[home-season-grid-no-itinerary-join]: related 상한 축소 — manifest
      take: 16,
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
  // REGRESSION-FREEZE[home-ssg-empty-poison]: build skip outside cache + empty bypass — manifest
  if (shouldSkipDbAtBuild()) return []
  const run = unstable_cache(
    () => loadSeasonProductGridUncached(),
    // v7: no itineraries join + tighter related take
    ['season-product-grid-pc-v7'],
    { revalidate: 21_600 },
  )
  return readCachedArrayOrBypassEmpty(run, () => loadSeasonProductGridUncached())
}
