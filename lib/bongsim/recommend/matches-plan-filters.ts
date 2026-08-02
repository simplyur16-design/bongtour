// REGRESSION-FREEZE[bongsim-pg-tls-global]: plans filter nameKr ↔ by-country 정합 — manifest
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { extractDaysFromDaysRaw } from "@/lib/bongsim/recommend/product-option";
import { resolveEffectivePlanType } from "@/lib/bongsim/recommend/resolve-effective-plan-type";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

export type PlanFilterRow = {
  plan_name: string;
  plan_type: string | null;
  days_raw: string;
  network_family?: string | null;
  allowance_label?: string | null;
  option_label?: string | null;
};

export type PlanFilterCtx = {
  country: string;
  days: number;
  allSelected: string[];
};

/** GET /api/bongsim/products/plans 매칭 SSOT — by-country 단일국·지역 패키지와 정합 */
export function matchesBongsimPlanFilters(row: PlanFilterRow, ctx: PlanFilterCtx): boolean {
  const covered = getPlanCoveredCountries(row.plan_name);
  const pt = resolveEffectivePlanType(row);
  if (!pt) return false;

  const d = extractDaysFromDaysRaw(row.days_raw);
  if (d == null || d < ctx.days) return false;

  if (ctx.allSelected.length === 1 && isRegionPackCode(ctx.allSelected[0]!)) {
    const planName = planNameForRegionPackCode(ctx.allSelected[0]!);
    return planName != null && row.plan_name.trim() === planName;
  }

  if (ctx.allSelected.length >= 2) {
    return covered.length >= 2 && doesPlanCoverAllSelected(row.plan_name, ctx.allSelected);
  }

  // by-country isSingleCountryForCode 와 동일 — coverage 1국 또는 plan_name === nameKr
  if (covered.length === 1 && covered[0] === ctx.country) return true;
  const nameKr = planNameKrFromCountryCode(ctx.country);
  return Boolean(nameKr && row.plan_name.trim() === nameKr);
}
