/**
 * 등록 schedule imageKeyword — routeText(일정요약) 세그먼트 순서 SSOT.
 * 6공급사 apply·preview 공통. description·schedule_section·본문 스캔 금지.
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: manifest
 */
import {
  englishFromScheduleKoreanSegment,
  normScheduleImageKeywordKey,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { isRegisterScheduleRoutePlaceNoise, isRegisterScheduleGenericTourismFillerRouteText } from '@/lib/register-schedule-route-place-noise'
import {
  acceptScheduleTourismImageKeywordOrEmpty,
  effectiveRouteTextForScheduleKeywordRow,
  isScheduleDomesticHubOnlyRouteText,
  resolveScheduleKeywordSlotKind,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isLikelyTourismLandmarkKeyword,
  isNonLandmarkRouteTextSegment,
} from '@/lib/pexels-place-name-keyword'
import {
  findAllScheduleSpotMatchesInText,
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
  routeContextualNationalAssemblyEnglish,
} from '@/lib/schedule-poi-regex-ssot'

export type RegisterScheduleRouteTextKeywordRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function isDomesticHubToken(token: string): boolean {
  const t = String(token ?? '').trim()
  if (!t) return true
  if (/^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u.test(t)) {
    return true
  }
  return /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i.test(t)
}

function rejectRouteKeywordCandidate(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isDomesticHubToken(t)) return true
  return false
}

/** SCHEDULE_SPOT 중 도시·스카이라인만 묘사하는 generic hub — routeText landmark 슬롯 제외 */
function isGenericCityHubSpotEn(en: string): boolean {
  return (
    /National Mall monuments|city view|skyline view|skyline|historic center view|townsite|coastal cliff park view/i.test(
      en,
    ) && !/(Memorial|Museum|Falls|Tower|Bridge|Park|Palace|Temple|Cathedral|Opera|Colosseum|Duomo|Capitol|Harbour|Harbor|Opera House)/i.test(en)
  )
}

function finalizeRouteSegmentKeyword(raw: string): string {
  try {
    return finalizeScheduleImageKeyword(raw)
  } catch {
    return String(raw ?? '').trim()
  }
}

function acceptRouteSegmentKeyword(raw: string, opts?: { allowCity?: boolean }): string {
  const fin = finalizeRouteSegmentKeyword(raw)
  if (!fin) return ''
  if (opts?.allowCity === false && isBareCityOrCountryKeyword(fin)) return ''
  return acceptScheduleTourismImageKeywordOrEmpty(fin) || acceptScheduleTourismImageKeywordOrEmpty(raw)
}

/** routeText 세그먼트 — 명소·POI만(도시·mapDestination 폴백 없음) */
function englishLandmarkOnlyFromScheduleKoreanSegment(
  seg: string,
  routeText?: string | null,
): string {
  const t = seg.trim()
  if (!t) return ''
  const assembly = routeContextualNationalAssemblyEnglish(t, routeText)
  if (assembly) {
    const kw = acceptRouteSegmentKeyword(assembly, { allowCity: false })
    if (kw) return kw
  }
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    const kw = acceptRouteSegmentKeyword(fromPoi, { allowCity: false })
    if (kw) return kw
  }
  for (const hit of findAllScheduleSpotMatchesInText(t)) {
    if (isGenericCityHubSpotEn(hit.en)) continue
    const kw = acceptRouteSegmentKeyword(hit.en, { allowCity: false })
    if (kw) return kw
  }
  return ''
}

/** routeText 한 세그먼트 → 영문 키워드(세그먼트 텍스트만 — 전체 haystack 스캔 없음) */
export function routeTextSegmentToImageKeyword(
  seg: string,
  opts?: { allowCity?: boolean; routeText?: string | null },
): string {
  const t = String(seg ?? '').trim()
  if (!t || isRegisterScheduleRoutePlaceNoise(t) || isNonLandmarkRouteTextSegment(t)) return ''
  if (/^[A-Za-z][A-Za-z0-9\s,.'-]{1,}$/.test(t) && !/[\uAC00-\uD7AF]/.test(t)) {
    return acceptRouteSegmentKeyword(t, opts)
  }
  const assembly = routeContextualNationalAssemblyEnglish(t, opts?.routeText)
  if (assembly) {
    const kw = acceptRouteSegmentKeyword(assembly, opts)
    if (kw) return kw
  }
  const fromKo =
    opts?.allowCity === false
      ? englishLandmarkOnlyFromScheduleKoreanSegment(t, opts?.routeText)
      : englishFromScheduleKoreanSegment(t)
  if (fromKo) {
    const kw = acceptRouteSegmentKeyword(fromKo, opts)
    if (kw) return kw
  }
  const fromSpot = firstMatchingScheduleSpotEn(t)
  if (fromSpot && (opts?.allowCity !== false || !isGenericCityHubSpotEn(fromSpot))) {
    const kw = acceptRouteSegmentKeyword(fromSpot, opts)
    if (kw) return kw
  }
  if (opts?.allowCity === false) return ''
  const fromCity = firstMatchingScheduleCityEn(t)
  if (fromCity) {
    const kw = acceptRouteSegmentKeyword(fromCity, opts)
    if (kw) return kw
  }
  return ''
}

function collectRouteTextKeywords(
  routeText: string | null | undefined,
  opts?: { allowCity?: boolean },
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const seg of splitRouteTextPlaceSegments(routeText)) {
    const kw = routeTextSegmentToImageKeyword(seg, { ...opts, routeText })
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || seen.has(nk)) continue
    seen.add(nk)
    out.push(kw)
  }
  return out
}

/** routeText A-B-C — 방문 순서대로 영문 키워드 후보(중복 제거, 도시-only 포함) */
export function collectRouteTextOrderedImageKeywords(routeText: string | null | undefined): string[] {
  return collectRouteTextKeywords(routeText, { allowCity: true })
}

/** routeText — 명소·랜드마크 세그먼트만(도시-only 세그먼트 제외) */
export function collectRouteTextOrderedLandmarkKeywords(routeText: string | null | undefined): string[] {
  return collectRouteTextKeywords(routeText, { allowCity: false })
}

function pickFirstUnused(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
): string {
  const ex = normScheduleImageKeywordKey(excludePrimary ?? '')
  for (const raw of ordered) {
    const kw = String(raw ?? '').trim()
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk) || (ex && nk === ex)) continue
    return kw
  }
  return ''
}

function pickFirstPreferLandmark(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
): string {
  const landmarks = ordered.filter((kw) => kw && isLikelyTourismLandmarkKeyword(kw))
  return pickFirstUnused(landmarks, used, excludePrimary) || pickFirstUnused(ordered, used, excludePrimary)
}

function pickSecondRouteKeyword(
  landmarkOrdered: readonly string[],
  allOrdered: readonly string[],
  primary: string,
  used: ReadonlySet<string>,
): string {
  const pk = normScheduleImageKeywordKey(primary)
  let passedPrimary = false
  for (const raw of landmarkOrdered) {
    const kw = String(raw ?? '').trim()
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!passedPrimary) {
      if (nk === pk) passedPrimary = true
      continue
    }
    if (used.has(nk)) continue
    if (isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(kw))) continue
    return kw
  }
  passedPrimary = false
  for (const raw of allOrdered) {
    const kw = String(raw ?? '').trim()
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!passedPrimary) {
      if (nk === pk) passedPrimary = true
      continue
    }
    if (used.has(nk) || nk === pk) continue
    if (isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(kw))) continue
    return kw
  }
  return ''
}

function pickReturnLandmarkWhenRouteTextMissing<T extends RegisterScheduleRouteTextKeywordRow>(
  day: number,
  sorted: readonly T[],
  used: ReadonlySet<string>,
): string {
  const prior = sorted.filter((r) => Number(r.day) > 0 && Number(r.day) < day)
  for (let pi = prior.length - 1; pi >= 0; pi--) {
    const row = prior[pi]!
    if (isScheduleDomesticHubOnlyRouteText(row.routeText, isDomesticHubToken)) continue
    const ordered = collectRouteTextOrderedLandmarkKeywords(row.routeText)
    for (let i = ordered.length - 1; i >= 0; i--) {
      const kw = ordered[i]!
      if (rejectRouteKeywordCandidate(kw)) continue
      if (isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(kw))) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (nk && used.has(nk)) continue
      return kw
    }
  }
  return ''
}

function forwardRouteKeywordFromNextDay<T extends RegisterScheduleRouteTextKeywordRow>(
  day: number,
  sorted: readonly T[],
): string {
  const next = sorted.find((r) => Number(r.day) > day)
  if (!next) return ''
  const ordered = collectRouteTextOrderedLandmarkKeywords(next.routeText)
  return pickFirstUnused(ordered, new Set()) || pickFirstPreferLandmark(
    collectRouteTextOrderedImageKeywords(next.routeText),
    new Set(),
  )
}

function backwardUnusedRouteKeywordFromPriorDays<T extends RegisterScheduleRouteTextKeywordRow>(
  day: number,
  sorted: readonly T[],
  used: ReadonlySet<string>,
): string {
  const prior = sorted.filter((r) => Number(r.day) > 0 && Number(r.day) < day)
  for (let pi = prior.length - 1; pi >= 0; pi--) {
    const row = prior[pi]!
    if (isScheduleDomesticHubOnlyRouteText(row.routeText, isDomesticHubToken)) continue
    const ordered = collectRouteTextOrderedLandmarkKeywords(row.routeText)
    for (let i = ordered.length - 1; i >= 0; i--) {
      const kw = ordered[i]!
      if (rejectRouteKeywordCandidate(kw)) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (used.has(nk)) continue
      return kw
    }
  }
  return ''
}

/** 6공급사 등록 apply — imageKeyword·imageKeyword2는 routeText 순서만 */
export function applyRegisterScheduleRouteTextImageKeywordsToRows<
  T extends RegisterScheduleRouteTextKeywordRow,
>(rows: T[]): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)))
  const used = new Set<string>()
  const byDay = new Map<number, { primary: string; secondary: string | null }>()

  for (const row of sorted) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, sorted.length)
    const routeTextForKeywords = String(row.routeText ?? '').trim()
    const movementHubLine = routeTextForKeywords
      ? ''
      : effectiveRouteTextForScheduleKeywordRow(row)
    const routeOrdered = collectRouteTextOrderedImageKeywords(row.routeText)
    const routeLandmarks = collectRouteTextOrderedLandmarkKeywords(row.routeText)
    let primary = ''
    let secondary: string | null = null

    if (slot === 'middle') {
      primary = pickFirstUnused(routeLandmarks, new Set()) || pickFirstPreferLandmark(routeOrdered, new Set())
      secondary =
        pickSecondRouteKeyword(routeLandmarks, routeOrdered, primary, new Set()) ||
        pickSecondRouteKeyword(routeOrdered, routeOrdered, primary, new Set())
      if (primary) used.add(normScheduleImageKeywordKey(primary))
      if (secondary) used.add(normScheduleImageKeywordKey(secondary))
    } else if (slot === 'departure') {
      primary = pickFirstUnused(routeLandmarks, used) || pickFirstPreferLandmark(routeOrdered, used)
      if (
        !primary &&
        (isScheduleDomesticHubOnlyRouteText(
          routeTextForKeywords || movementHubLine,
          isDomesticHubToken,
        ) ||
          isRegisterScheduleGenericTourismFillerRouteText(routeTextForKeywords))
      ) {
        primary = forwardRouteKeywordFromNextDay(day, sorted)
      }
      if (primary) used.add(normScheduleImageKeywordKey(primary))
    } else {
      primary = pickFirstPreferLandmark(routeOrdered, new Set()) || pickFirstUnused(routeLandmarks, new Set())
      if (primary && isBareCityOrCountryKeyword(primary)) primary = ''
      if (!primary) {
        primary = backwardUnusedRouteKeywordFromPriorDays(day, sorted, used)
      }
      if (!primary && !routeTextForKeywords && movementHubLine) {
        primary = pickReturnLandmarkWhenRouteTextMissing(day, sorted, used)
      }
      if (primary) used.add(normScheduleImageKeywordKey(primary))
    }

    byDay.set(day, { primary, secondary: slot === 'middle' ? secondary : null })
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const alloc = byDay.get(day)
    if (!alloc) return { ...row, imageKeyword: '', imageKeyword2: null }
    return {
      ...row,
      imageKeyword: alloc.primary,
      imageKeyword2: alloc.secondary,
    }
  })
}
