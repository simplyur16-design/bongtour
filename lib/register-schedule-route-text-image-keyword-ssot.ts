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
import { isRegisterScheduleRoutePlaceNoise, isRegisterScheduleGenericTourismFillerRouteText, isRegisterScheduleDomesticHubRouteSegment, stripRegisterScheduleRouteSegmentLodgingSuffix, filterRegisterScheduleRoutePlaceSegments } from '@/lib/register-schedule-route-place-noise'
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
  const t = stripRegisterScheduleRouteSegmentLodgingSuffix(String(seg ?? '').trim())
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

/** routeText 전체 regex 스캔 — 세그먼트 분리 전 명소 등장 순서(중복 제거) */
export function collectRouteTextSpotScanLandmarkKeywords(routeText: string | null | undefined): string[] {
  const raw = String(routeText ?? '').trim()
  if (!raw) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const hit of findAllScheduleSpotMatchesInText(raw)) {
    if (isGenericCityHubSpotEn(hit.en)) continue
    const kw = acceptRouteSegmentKeyword(hit.en, { allowCity: false })
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || seen.has(nk)) continue
    seen.add(nk)
    out.push(kw)
  }
  return out
}

/** routeText — 명소·랜드마크 세그먼트 + 전체 regex 스캔(세그먼트 순서 우선) */
export function collectRouteTextOrderedLandmarkKeywords(routeText: string | null | undefined): string[] {
  const fromSegments = collectRouteTextKeywords(routeText, { allowCity: false })
  const fromScan = collectRouteTextSpotScanLandmarkKeywords(routeText)
  const out: string[] = []
  const seen = new Set<string>()
  for (const kw of [...fromSegments, ...fromScan]) {
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || seen.has(nk)) continue
    seen.add(nk)
    out.push(kw)
  }
  return out
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

function pickLastPreferLandmark(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
): string {
  const ex = normScheduleImageKeywordKey(excludePrimary ?? '')
  const landmarks = ordered.filter((kw) => kw && isLikelyTourismLandmarkKeyword(kw))
  for (let i = landmarks.length - 1; i >= 0; i--) {
    const kw = String(landmarks[i] ?? '').trim()
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk) || (ex && nk === ex)) continue
    return kw
  }
  for (let i = ordered.length - 1; i >= 0; i--) {
    const kw = String(ordered[i] ?? '').trim()
    if (!kw || rejectRouteKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk) || (ex && nk === ex)) continue
    if (isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(kw))) continue
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

function pickMiddleDayPrimaryKeyword(
  routeLandmarks: readonly string[],
  routeOrdered: readonly string[],
  routeText?: string | null,
): string {
  const tourismSegCount = filterRegisterScheduleRoutePlaceSegments(
    splitRouteTextPlaceSegments(routeText),
  ).length
  const lead = String(routeLandmarks[0] ?? routeOrdered[0] ?? '').trim()
  const cityToLandmarkPair =
    tourismSegCount === 2 &&
    lead.length > 0 &&
    !isLikelyTourismLandmarkKeyword(finalizeRouteSegmentKeyword(lead))
  if (cityToLandmarkPair) {
    return (
      pickLastPreferLandmark(routeLandmarks, new Set()) ||
      pickLastPreferLandmark(routeOrdered, new Set()) ||
      pickFirstPreferLandmark(routeLandmarks, new Set())
    )
  }
  if (routeLandmarks.length >= 3) {
    const firstNk = normScheduleImageKeywordKey(String(routeLandmarks[0] ?? ''))
    const lastNk = normScheduleImageKeywordKey(String(routeLandmarks[routeLandmarks.length - 1] ?? ''))
    if (firstNk && firstNk === lastNk) {
      for (let i = 1; i < routeLandmarks.length - 1; i++) {
        const kw = String(routeLandmarks[i] ?? '').trim()
        if (kw && isLikelyTourismLandmarkKeyword(finalizeRouteSegmentKeyword(kw))) return kw
      }
      for (let i = 1; i < routeLandmarks.length - 1; i++) {
        const kw = String(routeLandmarks[i] ?? '').trim()
        if (kw && !isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(kw))) return kw
      }
    }
  }
  const tourismSegs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
  if (tourismSegs.length >= 3) {
    const firstKw = routeTextSegmentToImageKeyword(tourismSegs[0]!, { allowCity: true, routeText })
    const lastKw = routeTextSegmentToImageKeyword(tourismSegs[tourismSegs.length - 1]!, {
      allowCity: true,
      routeText,
    })
    if (
      firstKw &&
      lastKw &&
      normScheduleImageKeywordKey(firstKw) === normScheduleImageKeywordKey(lastKw)
    ) {
      for (let i = 1; i < tourismSegs.length - 1; i++) {
        const kw = routeTextSegmentToImageKeyword(tourismSegs[i]!, { allowCity: true, routeText })
        if (kw && !rejectRouteKeywordCandidate(kw)) return kw
      }
    }
  }
  return (
    pickFirstPreferLandmark(routeLandmarks, new Set()) ||
    pickFirstUnused(routeLandmarks, new Set()) ||
    pickFirstPreferLandmark(routeOrdered, new Set())
  )
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

/** middle day — routeText 2+ 세그먼트면 primary와 다른 세그먼트 키워드(도시 허용) */
export function pickSecondSegmentKeywordFromRouteText(
  routeText: string | null | undefined,
  primary: string,
  used: ReadonlySet<string>,
): string {
  const segments = splitRouteTextPlaceSegments(routeText)
    .map((s) => stripRegisterScheduleRouteSegmentLodgingSuffix(s))
    .filter(
      (s) =>
        s.length >= 2 &&
        !isRegisterScheduleRoutePlaceNoise(s) &&
        !isRegisterScheduleDomesticHubRouteSegment(s),
    )
  if (segments.length < 2) return ''
  const pk = normScheduleImageKeywordKey(primary)
  let primaryIdx = -1
  for (let i = 0; i < segments.length; i++) {
    const kw = routeTextSegmentToImageKeyword(segments[i]!, { allowCity: true, routeText })
    if (kw && normScheduleImageKeywordKey(kw) === pk) {
      primaryIdx = i
      break
    }
  }
  const trySegment = (seg: string): string => {
    const kw = routeTextSegmentToImageKeyword(seg, { allowCity: true, routeText })
    if (!kw || rejectRouteKeywordCandidate(kw)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || nk === pk || used.has(nk)) return ''
    return kw
  }
  if (primaryIdx >= 0) {
    for (let i = primaryIdx + 1; i < segments.length; i++) {
      const kw = trySegment(segments[i]!)
      if (kw) return kw
    }
    const tourismSegCount = filterRegisterScheduleRoutePlaceSegments(segments).length
    if (tourismSegCount === 2) {
      for (let i = 0; i < primaryIdx; i++) {
        const kw = trySegment(segments[i]!)
        if (kw) return kw
      }
    }
  }
  for (const seg of segments) {
    const kw = trySegment(seg)
    if (kw) return kw
  }
  return ''
}

function predictRowReservedPrimaryKeyword(
  row: RegisterScheduleRouteTextKeywordRow,
  day: number,
  maxDay: number,
  activeDays: number,
): string {
  const routeLandmarks = collectRouteTextOrderedLandmarkKeywords(row.routeText)
  const routeOrdered = collectRouteTextOrderedImageKeywords(row.routeText)
  const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
  if (slot === 'middle') {
    return pickMiddleDayPrimaryKeyword(routeLandmarks, routeOrdered, row.routeText)
  }
  return (
    pickFirstPreferLandmark(routeLandmarks, new Set()) ||
    pickFirstUnused(routeLandmarks, new Set()) ||
    pickFirstPreferLandmark(routeOrdered, new Set()) ||
    ''
  )
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

/** 출발일 forward-fill — 후속일 primary·kw2 예약 키 (dedupe adjacent SSOT) */
export function predictRowReservedKeywordKeysForForwardFill(
  row: RegisterScheduleRouteTextKeywordRow,
  day: number,
  maxDay: number,
  activeDays: number,
): Set<string> {
  return predictRowReservedKeywordKeys(row, day, maxDay, activeDays)
}

function predictRowReservedKeywordKeys(
  row: RegisterScheduleRouteTextKeywordRow,
  day: number,
  maxDay: number,
  activeDays: number,
): Set<string> {
  const keys = new Set<string>()
  const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
  const routeLandmarks = collectRouteTextOrderedLandmarkKeywords(row.routeText)
  const routeOrdered = collectRouteTextOrderedImageKeywords(row.routeText)
  const primary =
    slot === 'middle'
      ? pickMiddleDayPrimaryKeyword(routeLandmarks, routeOrdered, row.routeText)
      : predictRowReservedPrimaryKeyword(row, day, maxDay, activeDays)
  if (primary) keys.add(normScheduleImageKeywordKey(primary))
  if (slot === 'middle' && primary) {
    const secondary =
      pickSecondRouteKeyword(routeLandmarks, routeOrdered, primary, new Set()) ||
      pickSecondRouteKeyword(routeOrdered, routeOrdered, primary, new Set()) ||
      pickSecondSegmentKeywordFromRouteText(row.routeText, primary, new Set())
    if (secondary) keys.add(normScheduleImageKeywordKey(secondary))
  }
  return keys
}

function forwardRouteKeywordFromNextDay<T extends RegisterScheduleRouteTextKeywordRow>(
  day: number,
  sorted: readonly T[],
  maxDay: number,
  activeDays: number,
): string {
  for (const next of sorted) {
    const nd = Number(next.day)
    if (nd <= day) continue
    const reserved = predictRowReservedKeywordKeys(next, nd, maxDay, activeDays)
    const cands = collectRouteTextOrderedLandmarkKeywords(next.routeText).filter((kw) =>
      isLikelyTourismLandmarkKeyword(kw),
    )
    for (const kw of cands) {
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk || rejectRouteKeywordCandidate(kw) || reserved.has(nk)) continue
      return kw
    }
  }
  return ''
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
  const activeDays = sorted.length
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
      primary = pickMiddleDayPrimaryKeyword(routeLandmarks, routeOrdered, row.routeText)
      secondary =
        pickSecondRouteKeyword(routeLandmarks, routeOrdered, primary, new Set()) ||
        pickSecondRouteKeyword(routeOrdered, routeOrdered, primary, new Set()) ||
        pickSecondSegmentKeywordFromRouteText(row.routeText, primary, new Set())
      if (primary) used.add(normScheduleImageKeywordKey(primary))
      if (secondary) used.add(normScheduleImageKeywordKey(secondary))
    } else if (slot === 'departure') {
      const nextRow = sorted.find((r) => Number(r.day) > day)
      // REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: departure own-route landmark before forward — manifest
      // 후속일 forward를 먼저 쓰면 산문·타도시 누수(AVP7297 Da Lat) / 마카오→홍콩 출발일 오배정
      {
        const ownLandmark =
          pickFirstUnused(routeLandmarks, used) || pickFirstPreferLandmark(routeOrdered, used)
        if (
          ownLandmark &&
          isLikelyTourismLandmarkKeyword(finalizeRouteSegmentKeyword(ownLandmark)) &&
          !isBareCityOrCountryKeyword(finalizeRouteSegmentKeyword(ownLandmark))
        ) {
          primary = ownLandmark
        }
      }
      if (!primary) {
        primary = forwardRouteKeywordFromNextDay(day, sorted, maxDay, activeDays)
      }
      if (!primary) {
        const candidate =
          pickFirstUnused(routeLandmarks, used) || pickFirstPreferLandmark(routeOrdered, used)
        const hubCityOnly =
          candidate && nextRow && !isLikelyTourismLandmarkKeyword(finalizeRouteSegmentKeyword(candidate))
        if (candidate && nextRow && hubCityOnly) {
          // 출발 hub→도시 라인 — 도착 도시만으로는 채우지 않고 후속일 landmark forward-fill 우선
        } else if (candidate && nextRow) {
          const nextPrimary = predictRowReservedPrimaryKeyword(
            nextRow,
            Number(nextRow.day),
            maxDay,
            activeDays,
          )
          if (
            normScheduleImageKeywordKey(candidate) !== normScheduleImageKeywordKey(nextPrimary)
          ) {
            primary = candidate
          }
        } else if (candidate) {
          primary = candidate
        }
      }
      if (
        !primary &&
        (!routeTextForKeywords ||
          isScheduleDomesticHubOnlyRouteText(
            routeTextForKeywords || movementHubLine,
            isDomesticHubToken,
          ) ||
          isRegisterScheduleGenericTourismFillerRouteText(routeTextForKeywords))
      ) {
        primary = forwardRouteKeywordFromNextDay(day, sorted, maxDay, activeDays)
      }
      if (primary) used.add(normScheduleImageKeywordKey(primary))
    } else {
      primary =
        pickFirstPreferLandmark(routeOrdered, new Set()) || pickFirstUnused(routeLandmarks, new Set())
      if (primary && isBareCityOrCountryKeyword(primary)) primary = ''
      if (primary && !isLikelyTourismLandmarkKeyword(finalizeRouteSegmentKeyword(primary))) {
        primary = ''
      }
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
