/**
 * 플랜 선택 팝업 표시 범위 SSOT.
 * - unlimited·daily: |catalogDay - tripDays| ≤ window 인 SKU만 노출
 * - fixed(종량제): 일수 필터 없음 — 해당 국가 전체 노출 (봉사장 SSOT 49ca42d1)
 */
import type { ProductOption } from '@/lib/bongsim/recommend/product-option'
import { extractDaysFromDaysRaw } from '@/lib/bongsim/recommend/product-option'

export const TRIP_DAYS_DISPLAY_WINDOW = 2

export type PlanDisplayGroups = {
  unlimited: ProductOption[]
  daily: ProductOption[]
  fixed: ProductOption[]
}

/** `days_raw`에서 추출한 catalog 일수 (없으면 null) */
export function catalogDayOf(p: ProductOption): number | null {
  return extractDaysFromDaysRaw(p.days_raw)
}

export function isWithinTripDaysWindow(
  p: ProductOption,
  tripDaysFloored: number,
  window: number = TRIP_DAYS_DISPLAY_WINDOW,
): boolean {
  const d = catalogDayOf(p)
  if (d == null || !Number.isFinite(d)) return false
  return Math.abs(d - tripDaysFloored) <= window
}

export function filterByTripDaysWindow(
  plans: ProductOption[],
  tripDaysFloored: number,
  window: number = TRIP_DAYS_DISPLAY_WINDOW,
): ProductOption[] {
  return plans.filter((p) => isWithinTripDaysWindow(p, tripDaysFloored, window))
}

export function filterPlanGroupsByTripDaysWindow(
  groups: PlanDisplayGroups,
  tripDaysFloored: number,
  window: number = TRIP_DAYS_DISPLAY_WINDOW,
): PlanDisplayGroups {
  return {
    unlimited: filterByTripDaysWindow(groups.unlimited, tripDaysFloored, window),
    daily: filterByTripDaysWindow(groups.daily, tripDaysFloored, window),
    /** 종량제: ±2일 필터 미적용 — 전체 통과 */
    fixed: [...groups.fixed],
  }
}
