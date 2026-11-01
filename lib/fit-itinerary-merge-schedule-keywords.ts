/**
 * 자유여행 — 제미나이 예시 일정 일차 → 동선(routeText) + imageKeyword 병합.
 * REGRESSION-FREEZE[fit-itinerary-gemini-route-keyword]: 동선은 예시 일정 activities — manifest
 */
import {
  buildFitDayRouteText,
  collectFitDayEnglishPlaceNames,
  pickFitDayImageKeywordDistinct,
  pickSingleAirtelFitImageKeywordFromDays,
  type FitDayImageKeywordFallbackContext,
  type FitItineraryDayForKeyword,
} from '@/lib/fit-itinerary-pick-day-image-keyword'
import { persistScheduleImageKeyword, type ProductScheduleJsonRow } from '@/lib/schedule-image-keyword-persist'
import { isBrokenRegisterLandmarkKeyword, registerFitKeywordFromOwnDayPlaces } from '@/lib/register-pre-photo-guards'

/** 관광지 없는 출국·귀국일 — 앞선 일차 추천일정 장소 중 아직 안 쓴 영문 이름(가까운 날부터) */
function fitTripPlaceFallbackKeyword(
  sortedDays: FitItineraryDayForKeyword[],
  dayNum: number,
  usedLower: Set<string>,
): string | null {
  const earlier = sortedDays.filter((d) => Math.floor(Number(d.dayNumber)) < dayNum).reverse()
  const ok: string[] = []
  for (const d of earlier) {
    for (const name of collectFitDayEnglishPlaceNames(d)) {
      let kw = ''
      try {
        kw = persistScheduleImageKeyword(name) || ''
      } catch {
        kw = ''
      }
      if (!kw || /\s(?:di|de|del|della|des|du|da|of|the|la|le|al|alla|von|van)$/i.test(kw)) continue
      if (isBrokenRegisterLandmarkKeyword(kw, { allowHotelLodging: true })) continue
      ok.push(kw)
    }
  }
  // 안 쓴 장소 먼저, 없으면 가장 가까운 날 장소를 다시 쓴다('It'보다 낫다)
  return ok.find((kw) => !usedLower.has(kw.toLowerCase())) ?? ok[0] ?? null
}

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

    let kw = pickFitDayImageKeywordDistinct(fitDay, fallbackCtx, usedLower)
    // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 깨진 키워드('It')면 앞선 날 추천일정 장소로 — manifest
    const ownPlaces = collectFitDayEnglishPlaceNames(fitDay)
    if (
      !kw ||
      kw.toLowerCase() === 'travel' ||
      (!registerFitKeywordFromOwnDayPlaces({ fitPlaceKeywordsEn: ownPlaces }, kw) &&
        isBrokenRegisterLandmarkKeyword(kw, { allowHotelLodging: true }))
    ) {
      kw = fitTripPlaceFallbackKeyword(sortedDays, dayNum, usedLower) ?? kw
    }
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
    // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 그날 추천일정 장소 영문 이름을 함께 저장(등록 전 검사가 키워드 출처를 안다) — manifest
    ;(next as ProductScheduleJsonRow & { fitPlaceKeywordsEn?: string[] }).fitPlaceKeywordsEn = ownPlaces

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

  // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 자유여행 일정 = 제미나이 추천일정 일차만(원문 꼬리 일차·유령 일차 제거) — manifest
  const maxFitDay = sortedDays.reduce((m, d) => Math.max(m, Math.floor(Number(d.dayNumber)) || 0), 0)
  const rows = [...byDay.values()]
    .filter((r) => maxFitDay < 1 || Math.floor(Number(r.day)) <= maxFitDay)
    .sort((a, b) => a.day - b.day)
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
