/**
 * REGRESSION-FREEZE[schedule-image-keyword-adjacent-poi]
 * 출발·귀국·기내박 — 공항 키워드 금지, 전후일 관광명소 중 trip-wide 미사용 1개.
 * vitest lib/schedule-image-keyword-adjacent-poi.test.ts — manifest
 */
import { acceptScheduleImageKeywordOrEmpty, isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'

export type ScheduleAdjacentDayAlloc = {
  primary: string
  secondary: string | null
}

const IN_FLIGHT_OVERNIGHT_RE = /^기내박$/u

const AIRPORT_ROUTE_SEGMENT_RE =
  /(?:국제)?\s*공항|airport|터미널|terminal|JFK|Kennedy|Newark|LaGuardia|Heathrow|Gatwick|Changi|Suvarnabhumi|하츠필드|Hartsfield|Jackson|Atlanta\s+International/i

const AIRPORT_IMAGE_KEYWORD_RE =
  /\bairport\b|international\s+airport|departure\s+terminal|arrival\s+hall/i

/** routeText·title 이 기내박만인 이동일 */
export function isScheduleInFlightOvernightRow(row: {
  title?: string | null
  routeText?: string | null
}): boolean {
  const rt = String(row.routeText ?? '').trim()
  if (IN_FLIGHT_OVERNIGHT_RE.test(rt)) return true
  const title = String(row.title ?? '').trim()
  return IN_FLIGHT_OVERNIGHT_RE.test(title)
}

export function isScheduleAirportRouteSegmentText(seg: string): boolean {
  const t = String(seg ?? '').trim()
  if (!t) return false
  return AIRPORT_ROUTE_SEGMENT_RE.test(t)
}

/** 공항·허브만 있는 routeText — 관광 POI 추출 불가 */
export function isScheduleAirportOnlyRouteText(
  routeText: string | null | undefined,
  isDomesticHub: (token: string) => boolean,
): boolean {
  const raw = String(routeText ?? '').trim()
  if (!raw) return false
  if (isScheduleInFlightOvernightRow({ routeText: raw })) return true
  const segs = raw
    .split(/\s*(?:-(?!\d)|[\u2010\u2011\u2012\u2013\u2014\u2212–—]|\u2192|\u00b7|\u2022|,|，)\s*/u)
    .map((s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 2)
  if (!segs.length) return false
  return segs.every((s) => isDomesticHub(s) || isScheduleAirportRouteSegmentText(s))
}

/** imageKeyword 후보가 공항·generic 차단 대상인지 */
export function isScheduleAirportLikeImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  return AIRPORT_IMAGE_KEYWORD_RE.test(t)
}

export function acceptScheduleTourismImageKeywordOrEmpty(kw: string | null | undefined): string {
  const t = String(kw ?? '').trim()
  if (!t || isScheduleAirportLikeImageKeyword(t)) return ''
  return acceptScheduleImageKeywordOrEmpty(t) || t
}

function isKeywordUsedOnAdjacentDay(
  alloc: ScheduleAdjacentDayAlloc | undefined,
  kw: string,
  normKey: (s: string) => string,
): boolean {
  if (!alloc) return false
  const nk = normKey(kw)
  if (!nk) return true
  if (alloc.primary && normKey(alloc.primary) === nk) return true
  if (alloc.secondary && normKey(alloc.secondary) === nk) return true
  return false
}

function pickFirstUnusedFromCandidateList(
  candidates: readonly string[],
  used: ReadonlySet<string>,
  normKey: (s: string) => string,
  reject?: (kw: string) => boolean,
  dayAlloc?: ScheduleAdjacentDayAlloc,
  allowTripWideReuse = false,
  ignoreAdjacentDaySlots = false,
): string {
  for (const raw of candidates) {
    const kw = acceptScheduleTourismImageKeywordOrEmpty(raw)
    if (!kw) continue
    if (reject?.(kw)) continue
    const nk = normKey(kw)
    if (!nk) continue
    if (!allowTripWideReuse && used.has(nk)) continue
    if (!ignoreAdjacentDaySlots && isKeywordUsedOnAdjacentDay(dayAlloc, kw, normKey)) continue
    return kw
  }
  return ''
}

/** imageKeyword2 — route·후보 순서에서 primary와 distinct (trip-wide used 무시, 최후 폴백) */
export function pickDistinctScheduleRouteSecondKeyword(
  primary: string,
  routeOrdered: readonly string[],
  extraOrdered: readonly string[],
  overlaps: (a: string, b: string) => boolean,
  reject?: (kw: string) => boolean,
): string {
  const pk = String(primary ?? '').trim()
  if (!pk) return ''
  for (const list of [routeOrdered, extraOrdered]) {
    for (const raw of list) {
      const kw = String(raw ?? '').trim()
      if (!kw || reject?.(kw)) continue
      if (overlaps(kw, pk)) continue
      return kw
    }
  }
  return ''
}

export type FillScheduleMiddleKeyword2GapOpts = {
  primary: string
  routeOrdered: readonly string[]
  extraOrdered: readonly string[]
  overlaps: (a: string, b: string) => boolean
  rejectKeyword?: (kw: string) => boolean
  pickAdjacent: (allowTripWideReuse: boolean, ignoreAdjacentDaySlots?: boolean) => string
}

/** 중간일 imageKeyword2 빈 슬롯 — 당일 route에서 primary와 다른 landmark만 (타 일차 금지) */
export function fillScheduleMiddleImageKeyword2Gap(opts: FillScheduleMiddleKeyword2GapOpts): string {
  const { primary, routeOrdered, extraOrdered, overlaps, rejectKeyword } = opts
  if (!String(primary ?? '').trim()) return ''
  return (
    pickDistinctScheduleRouteSecondKeyword(
      primary,
      routeOrdered,
      extraOrdered,
      overlaps,
      rejectKeyword,
    ) || ''
  )
}

export type ScheduleKeywordSlotKind = 'departure' | 'middle' | 'return'

/** 1일=departure, 2~(N-1)=middle, N일=return — 단일 일차 카드(테스트·부분 preview)는 middle */
export function resolveScheduleKeywordSlotKind(
  day: number,
  maxDay: number,
  scheduleRowCount: number,
): ScheduleKeywordSlotKind {
  if (day === 1) return 'departure'
  if (maxDay >= 2 && day === maxDay) {
    if (scheduleRowCount === 1) return 'middle'
    return 'return'
  }
  return 'middle'
}

export type ShouldFillMiddleKeyword2GapRow = {
  routeText?: string | null
  title?: string | null
}

/** 중간일 kw2 빈 슬롯 — primary 있으면 인접·route·폴백으로 반드시 채움 */
export function shouldFillScheduleMiddleKeyword2Gap(
  row: ShouldFillMiddleKeyword2GapRow,
  routeOrdered: readonly string[],
  primary: string,
  overlaps: (a: string, b: string) => boolean,
  opts?: { movementOnly?: boolean; airportTransfer?: boolean },
): boolean {
  void row
  void routeOrdered
  void overlaps
  void opts
  return !!String(primary ?? '').trim()
}

export type PickAdjacentScheduleKeywordOpts<T> = {
  anchorDay: number
  maxDay: number
  sorted: readonly T[]
  getDay: (row: T) => number
  used: ReadonlySet<string>
  normKey: (kw: string) => string
  collectLandmarkCandidates: (row: T) => readonly string[]
  byDayAlloc?: ReadonlyMap<number, ScheduleAdjacentDayAlloc>
  /** D1=forward, 귀국=backward, 기내박=both */
  scan: 'forward' | 'backward' | 'both'
  rejectKeyword?: (kw: string) => boolean
  excludePrimary?: string
  allowTripWideReuse?: boolean
  /** kw2 최후 폴백 — trip-wide used·인접일 슬롯 무시(1≠2만) */
  ignoreAdjacentDaySlots?: boolean
}

/** 전후일 관광명소 후보에서 trip-wide·해당일 미사용 1개 */
export function pickUnusedScheduleImageKeywordFromAdjacentDays<T>(
  opts: PickAdjacentScheduleKeywordOpts<T>,
): string {
  const { anchorDay, maxDay, sorted, getDay, used, normKey, collectLandmarkCandidates, byDayAlloc, scan, rejectKeyword, excludePrimary, allowTripWideReuse, ignoreAdjacentDaySlots } =
    opts
  const reject = (kw: string) => {
    if (excludePrimary && normKey(kw) === normKey(excludePrimary)) return true
    return rejectKeyword?.(kw) ?? false
  }

  const tryDay = (day: number): string => {
    const row = sorted.find((r) => getDay(r) === day)
    if (!row) return ''
    return pickFirstUnusedFromCandidateList(
      collectLandmarkCandidates(row),
      used,
      normKey,
      reject,
      byDayAlloc?.get(day),
      allowTripWideReuse,
      ignoreAdjacentDaySlots,
    )
  }

  if (scan === 'forward' || scan === 'both') {
    for (let d = anchorDay + 1; d <= maxDay; d++) {
      const kw = tryDay(d)
      if (kw) return kw
    }
  }
  if (scan === 'backward' || scan === 'both') {
    for (let d = anchorDay - 1; d >= 1; d--) {
      const kw = tryDay(d)
      if (kw) return kw
    }
  }
  return ''
}
