import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import {
  doesPlanCoverAllSelected,
  getPlanCoveredCountries,
} from "@/lib/bongsim/plan-coverage-map";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import {
  computeRecommendedPrice,
  isTrueUnlimited,
  minRecommendedPrice,
} from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

export type CountryProductPack = {
  roaming: { min_price: number; products: ProductOption[] };
  local: { min_price: number; products: ProductOption[] } | null;
  roaming_unlimited_min: number | null;
  local_unlimited_min: number | null;
};

export type ProductsByCountryResult =
  | { ok: true; individual: Record<string, CountryProductPack>; multi: ProductOption[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

function attachRecommended(row: ProductOption): ProductOption {
  const rp = computeRecommendedPrice(row.price_block);
  return {
    ...row,
    recommended_price: rp ?? undefined,
  };
}

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

export async function loadProductsByCountry(selectedCodes: string[]): Promise<ProductsByCountryResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  try {
    const result = await pool.query(
      `SELECT 
        option_api_id,
        plan_name,
        network_family,
        plan_type,
        days_raw,
        allowance_label,
        option_label,
        price_block,
        flags
      FROM bongsim_product_option
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
      ORDER BY plan_name, days_raw, (price_block->'after'->>'recommended_krw')::numeric ASC NULLS LAST`,
    );
    const allProducts = (result.rows as unknown as ProductOption[]).map(attachRecommended);
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
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
