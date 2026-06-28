/**
 * 등록 schedule — trip 전체 imageKeyword·imageKeyword2 중복 제거 (6공급사 공통 후처리).
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: manifest
 */
import { normScheduleImageKeywordKey, splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { isScheduleAirportLikeImageKeyword } from '@/lib/schedule-image-keyword-adjacent-poi'
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

function isRejectedTripKeywordCandidate(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
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

/** 이미 쓴 키워드는 route·본문 후보에서 미사용 항목으로 교체, 없으면 빈 슬롯 */
export function enforceRegisterScheduleTripUniqueImageKeywords<T extends RegisterScheduleTripKeywordRow>(
  rows: T[],
): T[] {
  const used = new Set<string>()
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  return sorted.map((row) => {
    const cands = collectTripKeywordCandidates(row)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (primary && used.has(normScheduleImageKeywordKey(primary))) {
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
