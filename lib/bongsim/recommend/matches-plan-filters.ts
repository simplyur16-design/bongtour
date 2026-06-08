import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { extractDaysFromDaysRaw } from "@/lib/bongsim/recommend/product-option";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

export type PlanFilterRow = {
  plan_name: string;
  plan_type: string | null;
  days_raw: string;
};

export type PlanFilterCtx = {
  country: string;
  days: number;
  allSelected: string[];
};

/** GET /api/bongsim/products/plans 매칭 SSOT — by-country 지역 패키지 분기와 정합 */
export function matchesBongsimPlanFilters(row: PlanFilterRow, ctx: PlanFilterCtx): boolean {
  const covered = getPlanCoveredCountries(row.plan_name);
  const pt = (row.plan_type || "").trim().toLowerCase();

  if (pt !== "unlimited" && pt !== "daily" && pt !== "fixed") return false;

  const d = extractDaysFromDaysRaw(row.days_raw);
  if (d == null || d < ctx.days) return false;

  if (ctx.allSelected.length === 1 && isRegionPackCode(ctx.allSelected[0]!)) {
    const planName = planNameForRegionPackCode(ctx.allSelected[0]!);
    return planName != null && row.plan_name.trim() === planName;
  }

  if (ctx.allSelected.length >= 2) {
    return covered.length >= 2 && doesPlanCoverAllSelected(row.plan_name, ctx.allSelected);
  }

  const singleOk =
    covered.length === 1 &&
    covered[0] === ctx.country &&
    (pt === "daily" || pt === "unlimited" || pt === "fixed");

  return singleOk;
}
