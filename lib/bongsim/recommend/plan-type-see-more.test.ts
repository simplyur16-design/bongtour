import { describe, expect, it } from "vitest";
import {
  otherPlanTypeCount,
  planTypesStartExpanded,
  shouldShowOtherPlanTypesSeeMore,
  visiblePlanTypeTabs,
} from "@/lib/bongsim/recommend/plan-type-see-more";

// REGRESSION-FREEZE[bongsim-recommend-country-unlimited-first]: 무제한 우선·더보기 — manifest

describe("plan-type-see-more", () => {
  it("collapses to unlimited when unlimited SKUs exist", () => {
    expect(visiblePlanTypeTabs({ expanded: false, unlimitedCount: 3, otherCount: 5 })).toEqual([
      "unlimited",
    ]);
    expect(
      shouldShowOtherPlanTypesSeeMore({ expanded: false, unlimitedCount: 3, otherCount: 5 }),
    ).toBe(true);
  });

  it("hides 더보기 after expand", () => {
    expect(
      shouldShowOtherPlanTypesSeeMore({ expanded: true, unlimitedCount: 3, otherCount: 5 }),
    ).toBe(false);
    expect(visiblePlanTypeTabs({ expanded: true, unlimitedCount: 3, otherCount: 5 })).toEqual([
      "unlimited",
      "daily",
      "fixed",
    ]);
  });

  it("auto-expands when there is no unlimited SKU", () => {
    expect(planTypesStartExpanded(0, 4)).toBe(true);
    expect(visiblePlanTypeTabs({ expanded: false, unlimitedCount: 0, otherCount: 4 })).toEqual([
      "unlimited",
      "daily",
      "fixed",
    ]);
    expect(
      shouldShowOtherPlanTypesSeeMore({ expanded: false, unlimitedCount: 0, otherCount: 4 }),
    ).toBe(false);
  });

  it("hides 더보기 when there are no other plan types", () => {
    expect(otherPlanTypeCount({ daily: 0, fixed: 0 })).toBe(0);
    expect(
      shouldShowOtherPlanTypesSeeMore({ expanded: false, unlimitedCount: 2, otherCount: 0 }),
    ).toBe(false);
  });
});
