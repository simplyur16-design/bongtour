/**
 * Fit 예시 일정 — 일차별 imageKeyword 동기화.
 * REGRESSION-FREEZE[airtel-fit-per-day-keywords]: 단일 키워드 전일차 강제 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-lane-rematerialize]: Fit master → schedule 동선·키워드 — manifest
 */
import { prisma } from '@/lib/prisma'
import {
  buildProductScheduleJsonForDb,
  type ProductScheduleJsonRow,
} from '@/lib/schedule-image-keyword-persist'
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'
import type {
  FitDayImageKeywordFallbackContext,
  FitItineraryDayForKeyword,
} from '@/lib/fit-itinerary-pick-day-image-keyword'

export type SyncFitScheduleKeywordsResult = {
  updated: boolean
  dayKeywords: Record<number, string>
}

function parseScheduleRows(raw: string | null): ProductScheduleJsonRow[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((item) => {
        const row = item as Record<string, unknown>
        const day = Math.floor(Number(row.day))
        if (!Number.isFinite(day) || day < 1) return null
        return {
          day,
          title: typeof row.title === 'string' ? row.title : null,
          description: typeof row.description === 'string' ? row.description : null,
          routeText: typeof row.routeText === 'string' ? row.routeText : null,
          imageKeyword: typeof row.imageKeyword === 'string' ? row.imageKeyword : null,
          imageKeyword2: typeof row.imageKeyword2 === 'string' ? row.imageKeyword2 : null,
          imageUrl: row.imageUrl != null ? (row.imageUrl as string | null) : null,
          imageUrl2: row.imageUrl2 != null ? (row.imageUrl2 as string | null) : null,
          ...row,
        } as ProductScheduleJsonRow
      })
      .filter((r): r is ProductScheduleJsonRow => r != null)
  } catch {
    return []
  }
}

export { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'

/** DB FitItineraryMaster.days(+activities) → 키워드 병합용 일차 배열 */
export async function loadFitItineraryDaysForKeywordFromDb(
  productId: string,
): Promise<FitItineraryDayForKeyword[]> {
  const master = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: {
      days: {
        orderBy: { dayNumber: 'asc' },
        select: {
          dayNumber: true,
          title: true,
          summary: true,
          dayCityKey: true,
          activities: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              category: true,
              title: true,
              description: true,
              location: true,
            },
          },
        },
      },
    },
  })
  if (!master?.days.length) return []
  return master.days.map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    summary: d.summary ?? '',
    dayCityKey: d.dayCityKey ?? undefined,
    activities: d.activities.map((a) => ({
      order: a.order,
      category: a.category,
      title: a.title,
      description: a.description ?? '',
      location: a.location ?? '',
    })),
  }))
}

/** Fit master가 있으면 schedule에 추천일정 동선·imageKeyword를 다시 붙인다. */
export async function syncScheduleImageKeywordsFromFitMasterDb(
  productId: string,
): Promise<SyncFitScheduleKeywordsResult & { hadMaster: boolean }> {
  const fitDays = await loadFitItineraryDaysForKeywordFromDb(productId)
  if (!fitDays.length) {
    return { updated: false, dayKeywords: {}, hadMaster: false }
  }
  const result = await syncScheduleImageKeywordsFromFitItinerary(productId, fitDays)
  return { ...result, hadMaster: true }
}

export async function syncScheduleImageKeywordsFromFitItinerary(
  productId: string,
  fitDays: FitItineraryDayForKeyword[],
): Promise<SyncFitScheduleKeywordsResult> {
  if (!fitDays.length) {
    return { updated: false, dayKeywords: {} }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      productType: true,
      listingKind: true,
      schedule: true,
      title: true,
      cityKey: true,
      primaryDestination: true,
      destination: true,
    },
  })

  if (!product || !isAirHotelFitItineraryProduct(product)) {
    return { updated: false, dayKeywords: {} }
  }

  const fallbackCtx: FitDayImageKeywordFallbackContext = {
    cityNameKo: product.primaryDestination?.trim() || product.destination?.trim() || product.cityKey || '',
    cityKey: product.cityKey ?? '',
    productTitle: product.title ?? '',
    primaryDestination: product.primaryDestination,
    destination: product.destination,
  }

  const existing = parseScheduleRows(product.schedule)
  const { rows, dayKeywords } = mergeScheduleWithFitKeywords(existing, fitDays, fallbackCtx)
  const scheduleJson = buildProductScheduleJsonForDb(rows)

  const changed = scheduleJson !== (product.schedule ?? '')
  if (!changed) {
    return { updated: false, dayKeywords }
  }

  await prisma.product.update({
    where: { id: productId },
    data: { schedule: scheduleJson },
  })

  console.log(
    `[fit-itinerary-sync] schedule imageKeyword updated productId=${productId} days=${Object.entries(dayKeywords)
      .map(([d, k]) => `${d}:${k}`)
      .join(', ')}`,
  )

  return { updated: true, dayKeywords }
}
