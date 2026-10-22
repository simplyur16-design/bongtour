/**
 * 비슷한 일정 사실 비교 — 진입 href SSOT (상품 상세 CTA · 공개 travel 경로).
 * place/duration 추출은 loadSimilarItineraryCompare 매칭과 동일해야 함.
 * REGRESSION-FREEZE[similar-itinerary-compare-entry]: 사실 비교 CTA href — manifest
 */

import {
  composeHeroDayToken,
  durationHintFromTitle,
  scrubKrDepartureFromPlaceLabel,
} from '@/lib/bongtour-product-display-title-ssot'

/** 공개 경로 — 상품 상세 CTA·프리셋 진입 */
export const SIMILAR_ITINERARY_COMPARE_PATH = '/travel/similar-itinerary-compare'

export const SIMILAR_ITINERARY_COMPARE_CTA_LABEL = '같은 일정, 공급사별 사실 비교'

function normalizeDurationLabel(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** compare 로더 firstPlaceToken 과 동일 */
export function similarItineraryComparePlaceFromProduct(input: {
  primaryDestination?: string | null
  destination?: string | null
}): string {
  const scrubbed = scrubKrDepartureFromPlaceLabel(input.primaryDestination || input.destination || '')
  const raw = scrubbed || String(input.primaryDestination || input.destination || '').trim()
  return raw.split(/[·/,|，、]/)[0]?.trim() || ''
}

export function similarItineraryCompareDurationFromProduct(input: {
  duration?: string | null
  title?: string | null
  totalDays?: number | null
}): string {
  const fromDur = normalizeDurationLabel(input.duration || '')
  if (fromDur) return fromDur
  const composed = composeHeroDayToken(input.duration, input.totalDays)
  if (composed) return normalizeDurationLabel(composed)
  const hint = durationHintFromTitle(input.title || '')
  return hint ? normalizeDurationLabel(hint) : ''
}

export function buildSimilarItineraryCompareHref(input: {
  place: string
  duration: string
}): string | null {
  const place = String(input.place || '').trim()
  const duration = normalizeDurationLabel(input.duration)
  if (!place || !duration) return null
  const qs = new URLSearchParams({ place, duration })
  return `${SIMILAR_ITINERARY_COMPARE_PATH}?${qs.toString()}`
}

/** 상품 필드 → 비교 페이지 href. 매칭 불가 시 null */
export function buildSimilarItineraryCompareHrefFromProduct(input: {
  primaryDestination?: string | null
  destination?: string | null
  duration?: string | null
  title?: string | null
  totalDays?: number | null
}): string | null {
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: place+duration exact match — manifest
  return buildSimilarItineraryCompareHref({
    place: similarItineraryComparePlaceFromProduct(input),
    duration: similarItineraryCompareDurationFromProduct(input),
  })
}
