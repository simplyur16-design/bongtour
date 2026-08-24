import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { SIMPLYUR_MARKET_COUNTRY } from "@/lib/simplyur/constants";

// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: simplyur 한국 카탈로그에 경유팩·다국가 금지 — manifest

export function isKoreaSingleCountryProduct(p: ProductOption): boolean {
  return isSingleCountryForCode(p, SIMPLYUR_MARKET_COUNTRY);
}

/** simplyur·봉심 한국 목적지 SQL `plan_name = ANY(...)` — 한국/일본 등 다국가는 넣지 않음. */
export function koreaCatalogPlanNamesForSql(): string[] {
  const names = resolveDestinationPlanNamesForSql(SIMPLYUR_MARKET_COUNTRY);
  if (names && names.length > 0) return names;
  return ["대한민국", "한국", "대한민국(3Mbps)"];
}

function isSingleCountryForCode(p: ProductOption, code: string): boolean {
  const covered = getPlanCoveredCountries(p.plan_name);
  if (covered.length === 1 && covered[0] === code) return true;
  const nameKr = planNameKrFromCountryCode(code);
  return Boolean(nameKr && p.plan_name.trim() === nameKr);
}
