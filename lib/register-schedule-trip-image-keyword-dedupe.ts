/**
 * 등록 schedule — trip 전체 imageKeyword·imageKeyword2 중복 제거 (6공급사 공통 후처리).
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: domestic-hub-only — applyDomesticHubOnlyDepartureReturnAdjacentKeywords — manifest
 * 중간·관광 일 dedupe — 당일 route 후보만. 출발·귀국(인천 only)은 공급사 adjacent-poi SSOT 유지.
 */
import { englishFromScheduleKoreanSegment, normScheduleImageKeywordKey, splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import {
  isScheduleAirportLikeImageKeyword,
  isScheduleDomesticHubOnlyRouteText,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { isAirlineCarrierImageKeyword, isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { findAllMappedKoreanPoisInText } from '@/lib/pexels-keyword'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'

export type RegisterScheduleTripKeywordRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function isReturnDayCityLeakKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (/\bnha trang\b/i.test(t) && !/\bpo nagar\b/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

function isRejectedTripKeywordCandidate(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  return false
}

function collectTripKeywordCandidates(row: RegisterScheduleTripKeywordRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | null | undefined) => {
    const t = String(raw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t)) return
    const nk = normScheduleImageKeywordKey(t)
    if (!nk || seen.has(nk)) return
    seen.add(nk)
    out.push(t)
  }

  for (const seg of splitRouteTextPlaceSegments(row.routeText)) {
    if (isRegisterScheduleRoutePlaceNoise(seg)) continue
    push(firstMatchingScheduleSpotEn(seg))
    push(firstMatchingScheduleCityEn(seg))
    push(englishFromScheduleKoreanSegment(seg))
  }
  const hay = [row.routeText, row.title, row.description].filter(Boolean).join('\n')
  for (const poi of findAllMappedKoreanPoisInText(hay)) push(poi)
  return out
}

function pickUnusedTripKeyword(
  candidates: readonly string[],
  used: ReadonlySet<string>,
  exclude?: string,
): string {
  const ex = normScheduleImageKeywordKey(exclude ?? '')
  for (const c of candidates) {
    const nk = normScheduleImageKeywordKey(c)
    if (!nk || used.has(nk) || (ex && nk === ex)) continue
    return c
  }
  return ''
}

function isScheduleDomesticHubToken(token: string): boolean {
  const t = String(token ?? '').trim()
  if (!t) return true
  if (/^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u.test(t)) {
    return true
  }
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i.test(t)
}

function isDomesticHubOrAirportImageKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
  if (isScheduleDomesticHubToken(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  return false
}

/** 국내 허브 only 출발·귀국일 — adjacent-poi SSOT(도착지 forward / 마지막 관광 backward 미사용 명소) */
export function applyDomesticHubOnlyDepartureReturnAdjacentKeywords<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[]): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0))
  const used = new Set<string>()
  const byDay = new Map<number, ScheduleAdjacentDayAlloc>()

  for (const row of sorted) {
    const day = Number(row.day)
    if (day <= 0) continue
    const pk = String(row.imageKeyword ?? '').trim()
    const sk = String(row.imageKeyword2 ?? '').trim()
    byDay.set(day, { primary: pk, secondary: sk || null })
    if (!isScheduleDomesticHubOnlyRouteText(row.routeText, isScheduleDomesticHubToken)) {
      if (pk) used.add(normScheduleImageKeywordKey(pk))
      if (sk) used.add(normScheduleImageKeywordKey(sk))
    }
  }

  return sorted.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    if (!isScheduleDomesticHubOnlyRouteText(row.routeText, isScheduleDomesticHubToken)) return row

    const isDeparture = day === 1
    const isReturn = day === maxDay && maxDay >= 2
    if (!isDeparture && !isReturn) return row

    const prevDay = isReturn ? sorted.filter((r) => Number(r.day) > 0 && Number(r.day) < day).pop() : undefined
    const prevAlloc = prevDay ? byDay.get(Number(prevDay.day)) : undefined

    const overlapsPrevSlots = (kw: string): boolean => {
      if (!prevAlloc) return false
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk) return true
      for (const slot of [prevAlloc.primary, prevAlloc.secondary ?? '']) {
        const sk = normScheduleImageKeywordKey(slot)
        if (!sk) continue
        if (nk === sk || nk.includes(sk) || sk.includes(nk)) return true
      }
      return false
    }

    let picked = ''
    if (isDeparture) {
      const nextRow = sorted.find((r) => Number(r.day) > day)
      if (nextRow) {
        for (const kw of collectTripKeywordCandidates(nextRow)) {
          if (isDomesticHubOrAirportImageKeyword(kw)) continue
          picked = kw
          break
        }
      }
    } else if (isReturn && prevDay) {
      for (const kw of [...collectTripKeywordCandidates(prevDay)].reverse()) {
        if (isDomesticHubOrAirportImageKeyword(kw)) continue
        if (isReturnDayCityLeakKeyword(kw)) continue
        if (overlapsPrevSlots(kw)) continue
        const nk = normScheduleImageKeywordKey(kw)
        if (nk && used.has(nk)) continue
        picked = kw
        break
      }
    }

    const primary =
      picked && !isDomesticHubOrAirportImageKeyword(picked) ? picked : ''
    if (primary) used.add(normScheduleImageKeywordKey(primary))

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: null,
    }
  })
}

type ScheduleAdjacentDayAlloc = {
  primary: string
  secondary: string | null
}

/** @deprecated alias — hub/airport strip은 applyDomesticHubOnlyDepartureReturnAdjacentKeywords에 포함 */
export function sanitizeRegisterScheduleImageKeywordsOnDomesticHubOnlyDays<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[]): T[] {
  return applyDomesticHubOnlyDepartureReturnAdjacentKeywords(rows)
}

/** 이미 쓴 키워드는 당일 route·본문 후보만으로 교체 — 타 일차 landmark 금지, 없으면 빈 슬롯 */
export function enforceRegisterScheduleTripUniqueImageKeywords<T extends RegisterScheduleTripKeywordRow>(
  rows: T[],
): T[] {
  const used = new Set<string>()
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  return sorted.map((row) => {
    const hubOnlyDay = isScheduleDomesticHubOnlyRouteText(row.routeText, isScheduleDomesticHubToken)
    const cands = collectTripKeywordCandidates(row)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (hubOnlyDay) {
      if (primary && !isDomesticHubOrAirportImageKeyword(primary)) {
        used.add(normScheduleImageKeywordKey(primary))
      } else {
        primary = ''
      }
      return { ...row, imageKeyword: primary, imageKeyword2: null }
    }

    if (primary && used.has(normScheduleImageKeywordKey(primary))) {
      primary = pickUnusedTripKeyword(cands, used) || ''
    }
    if (!primary) {
      primary = pickUnusedTripKeyword(cands, used) || ''
    }
    if (primary) used.add(normScheduleImageKeywordKey(primary))

    if (secondary) {
      const nk2 = normScheduleImageKeywordKey(secondary)
      if (used.has(nk2) || nk2 === normScheduleImageKeywordKey(primary)) {
        secondary = pickUnusedTripKeyword(cands, used, primary) || ''
      }
    }
    if (secondary) used.add(normScheduleImageKeywordKey(secondary))

    return { ...row, imageKeyword: primary, imageKeyword2: secondary || null }
  })
}
