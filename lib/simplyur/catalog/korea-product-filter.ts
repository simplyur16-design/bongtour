import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { SIMPLYUR_MARKET_COUNTRY } from "@/lib/simplyur/constants";

export function isKoreaSingleCountryProduct(p: ProductOption): boolean {
  return isSingleCountryForCode(p, SIMPLYUR_MARKET_COUNTRY);
}

function isSingleCountryForCode(p: ProductOption, code: string): boolean {
  const covered = getPlanCoveredCountries(p.plan_name);
  if (covered.length === 1 && covered[0] === code) return true;
  const nameKr = planNameKrFromCountryCode(code);
  return Boolean(nameKr && p.plan_name.trim() === nameKr);
}
