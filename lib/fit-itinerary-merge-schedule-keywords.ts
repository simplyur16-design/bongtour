/**
 * Fit 일차 → Product.schedule imageKeyword 병합 (DB·Gemini 없음, 클라이언트 번들 가능).
 */
import {
  pickFitDayImageKeywordDistinct,
  type FitDayImageKeywordFallbackContext,
  type FitItineraryDayForKeyword,
} from '@/lib/fit-itinerary-pick-day-image-keyword'
import type { ProductScheduleJsonRow } from '@/lib/schedule-image-keyword-persist'

export function mergeScheduleWithFitKeywords(
  existing: ProductScheduleJsonRow[],
  fitDays: FitItineraryDayForKeyword[],
  fallbackCtx: FitDayImageKeywordFallbackContext,
): { rows: ProductScheduleJsonRow[]; dayKeywords: Record<number, string> } {
  const byDay = new Map<number, ProductScheduleJsonRow>()
  for (const row of existing) {
    byDay.set(Math.floor(Number(row.day)), { ...row })
  }

  const dayKeywords: Record<number, string> = {}
  const usedLower = new Set<string>()

  const sortedDays = [...fitDays].sort((a, b) => a.dayNumber - b.dayNumber)
  for (const fitDay of sortedDays) {
    const dayNum = Math.floor(Number(fitDay.dayNumber))
    if (!Number.isFinite(dayNum) || dayNum < 1) continue

    const kw = pickFitDayImageKeywordDistinct(fitDay, fallbackCtx, usedLower)
    dayKeywords[dayNum] = kw
    if (kw) usedLower.add(kw.toLowerCase())

    const prev = byDay.get(dayNum)
    const prevKw = String(prev?.imageKeyword ?? '').trim()
    const keywordChanged =
      kw.length > 0 && prevKw.length > 0 && prevKw.toLowerCase() !== kw.toLowerCase()

    const next: ProductScheduleJsonRow = {
      ...(prev ?? {
        day: dayNum,
        title: null,
        description: null,
        routeText: null,
        imageUrl: null,
        imageUrl2: null,
      }),
      day: dayNum,
      title: fitDay.title?.trim() || prev?.title || null,
      description: fitDay.summary?.trim() || prev?.description || null,
      imageKeyword: kw,
    }

    if (keywordChanged) {
      next.imageUrl = null
      next.imageUrl2 = null
      const extra = next as ProductScheduleJsonRow & {
        imageManualSelected?: boolean
        imageSelectionMode?: string | null
      }
      extra.imageManualSelected = false
      extra.imageSelectionMode = null
    }

    byDay.set(dayNum, next)
  }

  const rows = [...byDay.values()].sort((a, b) => a.day - b.day)
  return { rows, dayKeywords }
}
