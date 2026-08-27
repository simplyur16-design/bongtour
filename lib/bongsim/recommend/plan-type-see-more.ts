/**
 * 국가 선택 후 플랜 목록 — 무제한만 먼저, 더보기로 데일리·종량제.
 * REGRESSION-FREEZE[bongsim-recommend-country-unlimited-first]: 무제한 우선·더보기 — manifest
 */

export type PlanTypeTab = "unlimited" | "daily" | "fixed";

export const ALL_PLAN_TYPE_TABS: PlanTypeTab[] = ["unlimited", "daily", "fixed"];

export function otherPlanTypeCount(counts: {
  daily: number;
  fixed: number;
}): number {
  return Math.max(0, counts.daily) + Math.max(0, counts.fixed);
}

/** 무제한이 없으면 빈 화면에 가두지 않고 바로 전체 유형을 연다. */
export function planTypesStartExpanded(unlimitedCount: number, otherCount: number): boolean {
  return unlimitedCount <= 0 && otherCount > 0;
}

export function shouldShowOtherPlanTypesSeeMore(opts: {
  expanded: boolean;
  unlimitedCount: number;
  otherCount: number;
}): boolean {
  if (opts.expanded) return false;
  return opts.unlimitedCount > 0 && opts.otherCount > 0;
}

export function visiblePlanTypeTabs(opts: {
  expanded: boolean;
  unlimitedCount: number;
  otherCount: number;
}): PlanTypeTab[] {
  const expanded = opts.expanded || planTypesStartExpanded(opts.unlimitedCount, opts.otherCount);
  if (expanded) return ALL_PLAN_TYPE_TABS;
  return ["unlimited"];
}
