/**
 * /travel/air-hotel 시즌 큐레이션 read layer — 6h 캐시.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import {
  getAirHotelCycleIdForNow,
  getAirHotelExposureMonthKeys,
} from '@/lib/air-hotel-season-curation-constants'

export type AirHotelSeasonHeroSlide = {
  monthKey: string
  monthLabel: string
  message: string
  productId: string
  productTitle: string
  productImageUrl: string
  productHref: string
}

export type AirHotelSeasonCurationDTO = {
  cycleId: string
  monthlyMessages: Record<string, string>
  heroSlides: AirHotelSeasonHeroSlide[]
}

const productSelect = {
  id: true,
  title: true,
  bgImageUrl: true,
  schedule: true,
  itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' as const }, take: 24 },
} as const

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}년 ${parseInt(month ?? '0', 10)}월`
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

function productCoverUrl(p: {
  bgImageUrl: string | null
  schedule: string | null
  itineraries: { day: number; description: string }[]
}): string {
  const scheduleRows = getScheduleFromProduct(p as Parameters<typeof getScheduleFromProduct>[0])
  return (getFinalCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays: scheduleRows }) ?? '').trim()
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
  const monthKeys = getAirHotelExposureMonthKeys(row.cycleId)
  const orderedIds: { monthKey: string; productId: string }[] = []
  for (const monthKey of monthKeys) {
    for (const productId of linkedMap[monthKey] ?? []) {
      orderedIds.push({ monthKey, productId })
    }
  }

  if (orderedIds.length === 0) {
    return { cycleId: row.cycleId, monthlyMessages, heroSlides: [] }
  }

  const allIds = [...new Set(orderedIds.map((x) => x.productId))]
  const products = await prisma.product.findMany({
    where: {
      id: { in: allIds },
      registrationStatus: 'registered',
      AND: [publicProductWhereClause(now)],
    },
    select: productSelect,
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  const heroSlides: AirHotelSeasonHeroSlide[] = []
  for (const { monthKey, productId } of orderedIds) {
    const p = byId.get(productId)
    if (!p) continue
    const cover = productCoverUrl(p)
    if (!cover) continue
    heroSlides.push({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      message: monthlyMessages[monthKey] ?? '',
      productId: p.id,
      productTitle: p.title,
      productImageUrl: cover,
      productHref: `/products/${p.id}`,
    })
  }

  return {
    cycleId: row.cycleId,
    monthlyMessages,
    heroSlides,
  }
}

export async function getCachedAirHotelSeasonCuration(): Promise<AirHotelSeasonCurationDTO | null> {
  const run = unstable_cache(
    () => loadAirHotelSeasonCurationUncached(),
    ['air-hotel-season-curation-v3'],
    { revalidate: 21_600, tags: ['air-hotel-season'] },
  )
  return run()
}
