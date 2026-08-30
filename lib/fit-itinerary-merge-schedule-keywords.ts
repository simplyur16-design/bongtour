/**
 * 자유여행 — 제미나이 예시 일정 일차 → 동선(routeText) + imageKeyword 병합.
 * REGRESSION-FREEZE[fit-itinerary-gemini-route-keyword]: 동선은 예시 일정 activities — manifest
 */
import {
  buildFitDayRouteText,
  pickFitDayImageKeywordDistinct,
  pickSingleAirtelFitImageKeywordFromDays,
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
    const routeFromFit = buildFitDayRouteText(fitDay)

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
      routeText: routeFromFit || prev?.routeText || null,
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

/** 자유여행 SSOT — 예시 일정에서 뽑은 imageKeyword 1개를 모든 일차에 동일 적용 */
export function mergeScheduleWithSingleAirtelFitKeyword(
  existing: ProductScheduleJsonRow[],
  fitDays: FitItineraryDayForKeyword[],
  fallbackCtx: FitDayImageKeywordFallbackContext,
): { rows: ProductScheduleJsonRow[]; dayKeywords: Record<number, string> } {
  const byDay = new Map<number, ProductScheduleJsonRow>()
  for (const row of existing) {
    byDay.set(Math.floor(Number(row.day)), { ...row })
  }

  const singleKw = pickSingleAirtelFitImageKeywordFromDays(fitDays, fallbackCtx)
  const dayKeywords: Record<number, string> = {}

  const sortedDays = [...fitDays].sort((a, b) => a.dayNumber - b.dayNumber)
  for (const fitDay of sortedDays) {
    const dayNum = Math.floor(Number(fitDay.dayNumber))
    if (!Number.isFinite(dayNum) || dayNum < 1) continue
    dayKeywords[dayNum] = singleKw

    const prev = byDay.get(dayNum)
    const prevKw = String(prev?.imageKeyword ?? '').trim()
    const keywordChanged =
      singleKw.length > 0 && prevKw.length > 0 && prevKw.toLowerCase() !== singleKw.toLowerCase()
    const routeFromFit = buildFitDayRouteText(fitDay)

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
      routeText: routeFromFit || prev?.routeText || null,
      imageKeyword: singleKw,
      imageKeyword2: null,
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
