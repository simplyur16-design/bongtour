/**
 * Fit 예시 일정 생성 성공 직후 — Product.schedule imageKeyword를 일차별 예시 일정에 맞게 갱신.
 * (신규·backfill 등록분; 기존 상품 일괄 백필은 별도)
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
