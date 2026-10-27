/**
 * 지방출발 메가메뉴 탭 노출 — 상품 0건이면 숨기는 탭(현재 제주출발).
 * REGRESSION-FREEZE[local-departure-display-prefix]: jeju_dep 탭은 공개 상품 ≥1건일 때만 — manifest
 * 클라이언트 번들 안전.
 */
import type { LocalDepartureTag } from '@/lib/product-listing-kind'

/** 상품 0건이면 숨기는 지방출발 탭 (기존 부산·청주·대구 탭은 항상 노출 — 기존 동작 유지) */
export const LOCAL_DEPARTURE_TABS_HIDDEN_WHEN_EMPTY: readonly LocalDepartureTag[] = ['jeju']

export type LocalDepartureTabCounts = Partial<Record<LocalDepartureTag, number>>

/**
 * `localDeparture` 가 숨김 대상이면 count ≥ 1 일 때만 남긴다.
 * count 미확인(undefined)도 숨김 — 빈 탭이 잠깐 보였다 사라지는 깜빡임 방지.
 */
export function filterLocalDepartureTabsByCount<T extends { localDeparture?: string | null }>(
  regions: readonly T[],
  counts: LocalDepartureTabCounts | null | undefined,
): T[] {
  const hidden = new Set<string>(LOCAL_DEPARTURE_TABS_HIDDEN_WHEN_EMPTY)
  return regions.filter((r) => {
    const tag = r.localDeparture
    if (!tag || !hidden.has(tag)) return true
    const n = counts?.[tag as LocalDepartureTag]
    return typeof n === 'number' && n >= 1
  })
}

/** browse API 지방출발 탭 쿼리 (`region={tag}_dep&limit=1`) — `total` 만 사용 */
export function localDepartureTabCountUrl(tag: LocalDepartureTag): string {
  return `/api/products/browse?region=${encodeURIComponent(`${tag}_dep`)}&limit=1`
}
