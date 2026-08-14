import { COUNTRY_OPTIONS, planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import { MULTI_COUNTRY_PLAN_COVERAGE } from "@/lib/bongsim/plan-coverage-map";
import {
  isRegionPackCode,
  planNamesForRegionPackCode,
} from "@/lib/bongsim/recommend/region-pack-plan";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 단일 목적지 SQL plan_name SSOT — manifest

const EXTRA_KO_NAME_TO_CODE: Record<string, string> = {
  대한민국: "kr",
  한국: "kr",
  "터키(튀르키예)": "tr",
  튀르키예: "tr",
  사이판: "mp",
  북마리아나제도: "mp",
  아랍에미레이트: "ae",
};

/**
 * 단일 codes 요청용 — DB `plan_name = ANY($1)` 필터.
 * isSingleCountryForCode와 정합 (한글 alias·권역 pack 포함).
 */
export function resolveDestinationPlanNamesForSql(code: string): string[] | null {
  const lc = code.trim().toLowerCase();
  if (!lc) return null;

  if (isRegionPackCode(lc)) {
    const regionPlans = planNamesForRegionPackCode(lc);
    return regionPlans.length > 0 ? regionPlans : null;
  }

  const names = new Set<string>();
  const fromHelper = planNameKrFromCountryCode(lc);
  if (fromHelper) names.add(fromHelper);

  const fromOptions = COUNTRY_OPTIONS.find((c) => c.code === lc)?.nameKr;
  if (fromOptions) names.add(fromOptions);

  for (const [ko, mapped] of Object.entries(EXTRA_KO_NAME_TO_CODE)) {
    if (mapped === lc) names.add(ko);
  }

  for (const [planName, codes] of Object.entries(MULTI_COUNTRY_PLAN_COVERAGE)) {
    if (codes.length === 1 && codes[0]!.toLowerCase() === lc) names.add(planName);
  }

  return names.size > 0 ? [...names] : null;
}
