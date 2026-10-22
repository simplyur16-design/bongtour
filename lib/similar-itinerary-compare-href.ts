/**
 * 비슷한 일정 사실 비교 — 진입 href SSOT (상품 상세 CTA · 공개 travel 경로).
 * place/duration 추출은 loadSimilarItineraryCompare 매칭과 동일해야 함.
 * REGRESSION-FREEZE[similar-itinerary-compare-entry]: 사실 비교 CTA href — manifest
 */

import {
  normalizeCompareDurationLabel,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'

/** 공개 경로 — 상품 상세 CTA·프리셋 진입 */
export const SIMILAR_ITINERARY_COMPARE_PATH = '/travel/similar-itinerary-compare'

export const SIMILAR_ITINERARY_COMPARE_CTA_LABEL = '같은 일정, 공급사별 사실 비교'

/** 메가메뉴 leaf 라벨 — 나라/탭 단독이면 빈 문자열 */
export function similarItineraryComparePlaceFromProduct(input: {
  primaryDestination?: string | null
  destination?: string | null
  title?: string | null
}): string {
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: place는 메가메뉴 leaf — manifest
  return (
    resolveComparePlaceCluster({
      primaryDestination: input.primaryDestination,
      destination: input.destination,
      title: input.title,
    })?.label || ''
  )
}

export function similarItineraryCompareDurationFromProduct(input: {
  duration?: string | null
  title?: string | null
  totalDays?: number | null
}): string {
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: duration은 compose·title 힌트만 (임의 문자열 통과 금지) — manifest
  return normalizeCompareDurationLabel(input.duration, input.title, input.totalDays)
}

export function buildSimilarItineraryCompareHref(input: {
  place: string
  duration: string
}): string | null {
  const placeCluster = resolveComparePlaceCluster({ placeQuery: input.place })
  const place = placeCluster?.label || ''
  const duration = normalizeCompareDurationLabel(input.duration)
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
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: place+duration 메가메뉴 leaf 클러스터 — manifest
  return buildSimilarItineraryCompareHref({
    place: similarItineraryComparePlaceFromProduct(input),
    duration: similarItineraryCompareDurationFromProduct(input),
  })
}
