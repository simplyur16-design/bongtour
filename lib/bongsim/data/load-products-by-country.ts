import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import {
  doesPlanCoverAllSelected,
  getPlanCoveredCountries,
} from "@/lib/bongsim/plan-coverage-map";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import {
  isTrueUnlimited,
  minRecommendedPrice,
} from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { fetchAllActiveProductOptionsFromDb } from "@/lib/bongsim/data/load-all-active-products";

export type CountryProductPack = {
  roaming: { min_price: number; products: ProductOption[] };
  local: { min_price: number; products: ProductOption[] } | null;
  roaming_unlimited_min: number | null;
  local_unlimited_min: number | null;
};

export type ProductsByCountryResult =
  | { ok: true; individual: Record<string, CountryProductPack>; multi: ProductOption[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

function isSingleCountryForCode(p: ProductOption, code: string): boolean {
  const covered = getPlanCoveredCountries(p.plan_name);
  if (covered.length === 1 && covered[0] === code) return true;
  const nameKr = planNameKrFromCountryCode(code);
  return Boolean(nameKr && p.plan_name.trim() === nameKr);
}

function roamingTrueUnlimitedForMin(p: ProductOption): boolean {
  return (p.network_family || "").toLowerCase() === "roaming" && isTrueUnlimited(p);
}

function localTrueUnlimitedForMin(p: ProductOption): boolean {
  return (p.network_family || "").toLowerCase() === "local" && isTrueUnlimited(p);
}

function packFromProducts(single: ProductOption[]): CountryProductPack {
  const roamingArr = single.filter((p) => (p.network_family || "").toLowerCase() === "roaming");
  const localArr = single.filter((p) => (p.network_family || "").toLowerCase() === "local");
  const roamingMin = minRecommendedPrice(roamingArr);
  const localMin = localArr.length ? minRecommendedPrice(localArr) : null;
  const roamingUnl = roamingArr.filter((p) => roamingTrueUnlimitedForMin(p));
  const localUnl = localArr.filter((p) => localTrueUnlimitedForMin(p));
  return {
    roaming: {
      min_price: roamingMin ?? 0,
      products: roamingArr,
    },
    local:
      localArr.length > 0
        ? {
            min_price: localMin ?? 0,
            products: localArr,
          }
        : null,
    roaming_unlimited_min: minRecommendedPrice(roamingUnl),
    local_unlimited_min: localArr.length > 0 ? minRecommendedPrice(localUnl) : null,
  };
}

/** 메모리 — 캐시된 전체 카탈로그에서 국가별 pack 추출 */
export function filterProductsByCountry(
  allProducts: ProductOption[],
  selectedCodes: string[],
): ProductsByCountryResult {
  const individual: Record<string, CountryProductPack> = {};

  if (selectedCodes.length === 1 && isRegionPackCode(selectedCodes[0]!)) {
    const regionCode = selectedCodes[0]!;
    const planName = planNameForRegionPackCode(regionCode);
    const regional =
      planName != null ? allProducts.filter((p) => p.plan_name.trim() === planName) : [];
    individual[regionCode] = packFromProducts(regional);
    return { ok: true, individual, multi: [] };
  }

  for (const code of selectedCodes) {
    const single = allProducts.filter((p) => isSingleCountryForCode(p, code));
    individual[code] = packFromProducts(single);
  }

  const multi =
    selectedCodes.length < 2
      ? []
      : allProducts.filter((p) => {
          const covered = getPlanCoveredCountries(p.plan_name);
          return covered.length >= 2 && doesPlanCoverAllSelected(p.plan_name, selectedCodes);
        });

  return { ok: true, individual, multi };
}

/** uncached — DB 직접 (테스트·스크립트용) */
export async function loadProductsByCountry(selectedCodes: string[]): Promise<ProductsByCountryResult> {
  const catalog = await fetchAllActiveProductOptionsFromDb();
  if (!catalog.ok) return catalog;
  return filterProductsByCountry(catalog.products, selectedCodes);
}
