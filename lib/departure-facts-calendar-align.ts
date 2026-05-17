import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'
import {
  combineDateKeyWithHm,
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
  parseFlexibleDateTimeLineToDate,
} from '@/lib/flight-korean-datetime'
import { addDaysIso, diffCalendarDaysIso, extractIsoDate } from '@/lib/hero-date-utils'
import { computeReturnDate } from '@/lib/package-rules'

function shiftLegCalendarDays(leg: DepartureLegCard | null, dayDelta: number): DepartureLegCard | null {
  if (!leg || dayDelta === 0) return leg
  const shiftAt = (at: string | null | undefined): string | null => {
    if (!at?.trim()) return at ?? null
    const dt = parseFlexibleDateTimeLineToDate(at)
    if (!dt) return at.trim()
    dt.setDate(dt.getDate() + dayDelta)
    return formatKoreanDateTimeLine(dt) ?? at.trim()
  }
  return {
    ...leg,
    departureAtText: shiftAt(leg.departureAtText),
    arrivalAtText: shiftAt(leg.arrivalAtText),
  }
}

/** leg 일시의 시·분을 유지한 채 달력 `dateKey` 날짜로 맞춘다 */
function alignAtTextToCalendarDate(
  atText: string | null | undefined,
  dateKey: string | null | undefined
): string | null {
  if (!atText?.trim() || !dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return atText?.trim() ?? null
  const hm = extractHmFromKoreanDateTimeLine(atText)
  if (hm) {
    const d = combineDateKeyWithHm(dateKey, hm)
    if (d) return formatKoreanDateTimeLine(d)
  }
  const parsed = parseFlexibleDateTimeLineToDate(atText)
  const anchorIso = extractIsoDate(atText)
  if (parsed && anchorIso && anchorIso !== dateKey) {
    const delta = diffCalendarDaysIso(anchorIso, dateKey)
    if (delta != null && delta !== 0) {
      parsed.setDate(parsed.getDate() + delta)
      return formatKoreanDateTimeLine(parsed)
    }
  }
  if (parsed && anchorIso === dateKey) return formatKoreanDateTimeLine(parsed)
  return atText.trim()
}

function alignLegToCalendarDate(leg: DepartureLegCard | null, depDateKey: string, arrDateKey: string): DepartureLegCard | null {
  if (!leg) return null
  return {
    ...leg,
    departureAtText: alignAtTextToCalendarDate(leg.departureAtText, depDateKey) ?? leg.departureAtText,
    arrivalAtText: alignAtTextToCalendarDate(leg.arrivalAtText, arrDateKey) ?? leg.arrivalAtText,
  }
}

export type AlignDepartureFactsCalendarOpts = {
  /** 귀국일(YYYY-MM-DD) — 없으면 `packageTotalDays`로 출발일에서 계산 */
  returnDateIso?: string | null
  packageTotalDays?: number
}

/**
 * 달력 선택 출발일·귀국일에 맞춰 가는편·오는편 일시를 공개 상세용으로 정렬.
 * 공급사 공통 — 등록 본문 템플릿·ISO 하이픈 형식·첫 출발행 고정 날짜 모두 보정.
 */
export function alignDepartureKeyFactsToSelectedCalendarDate(
  facts: DepartureKeyFacts | null,
  selectedDepartureIso: string | null | undefined,
  opts?: AlignDepartureFactsCalendarOpts
): DepartureKeyFacts | null {
  if (!facts) return null
  const target = selectedDepartureIso?.trim()
  if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return facts

  const returnKey =
    (opts?.returnDateIso?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(opts.returnDateIso.trim())
      ? opts.returnDateIso.trim()
      : null) ??
    (opts?.packageTotalDays != null && opts.packageTotalDays > 0
      ? computeReturnDate(target, opts.packageTotalDays)
      : null)

  const obAnchor =
    extractIsoDate(facts.outbound?.departureAtText) ??
    extractIsoDate(facts.outbound?.arrivalAtText) ??
    extractIsoDate(facts.inbound?.departureAtText) ??
    null

  if (!obAnchor) return facts

  const deltaToDep = diffCalendarDaysIso(obAnchor, target)
  if (deltaToDep == null) return facts

  if (deltaToDep !== 0) {
    return {
      ...facts,
      outbound: shiftLegCalendarDays(facts.outbound, deltaToDep),
      inbound: shiftLegCalendarDays(facts.inbound, deltaToDep),
    }
  }

  if (!returnKey || returnKey === target) {
    return {
      ...facts,
      outbound: alignLegToCalendarDate(facts.outbound, target, target) ?? facts.outbound,
      inbound: facts.inbound,
    }
  }

  const ib = facts.inbound
  if (!ib) {
    return {
      ...facts,
      outbound: alignLegToCalendarDate(facts.outbound, target, target) ?? facts.outbound,
    }
  }

  const ibDepAnchor = extractIsoDate(ib.departureAtText) ?? extractIsoDate(ib.arrivalAtText)
  const arrOffset =
    ibDepAnchor && extractIsoDate(ib.arrivalAtText)
      ? (diffCalendarDaysIso(ibDepAnchor, extractIsoDate(ib.arrivalAtText)!) ?? 0)
      : 0
  const ibArrKey = arrOffset > 0 ? (addDaysIso(returnKey, arrOffset) ?? returnKey) : returnKey

  return {
    ...facts,
    outbound: alignLegToCalendarDate(facts.outbound, target, target) ?? facts.outbound,
    inbound: alignLegToCalendarDate(ib, returnKey, ibArrKey) ?? ib,
  }
}

/** 상세 컴포넌트용 — facts + 달력일 + (선택) 귀국·일수 */
export function resolvePublicDetailAlignedDepartureFacts(
  facts: DepartureKeyFacts | null,
  selectedDate: string | null | undefined,
  opts?: AlignDepartureFactsCalendarOpts
): DepartureKeyFacts | null {
  return alignDepartureKeyFactsToSelectedCalendarDate(facts, selectedDate, opts)
}
