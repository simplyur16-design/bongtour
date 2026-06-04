import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
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

/**
 * GET /api/bongsim/products/by-country?codes=jp,kr
 *
 * 응답:
 *   {
 *     individual: {
 *       jp: {
 *         roaming: { min_price, products },
 *         local: { min_price, products } | null,
 *         roaming_unlimited_min: number | null,
 *         local_unlimited_min: number | null,
 *       },
 *     },
 *     multi: ProductOption[],
 *   }
 */

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codesStr = searchParams.get("codes") || "";

  const selectedCodes = codesStr
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (selectedCodes.length === 0) {
    return jsonWithLeakGuard(
      { error: "codes parameter required" },
      "bongsim.products.by-country",
      { status: 400 },
    );
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "DB not configured" }, "bongsim.products.by-country", { status: 500 });
  }

  try {
    const query = `
      SELECT 
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
      ORDER BY plan_name, days_raw, (price_block->'after'->>'recommended_krw')::numeric ASC NULLS LAST
    `;

    const result = await pool.query(query);
    const allProducts = (result.rows as unknown as ProductOption[]).map(attachRecommended);

    type CountryPack = {
      roaming: { min_price: number; products: ProductOption[] };
      local: { min_price: number; products: ProductOption[] } | null;
      roaming_unlimited_min: number | null;
      local_unlimited_min: number | null;
    };

    const individual: Record<string, CountryPack> = {};

    function packFromProducts(single: ProductOption[]): CountryPack {
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

    if (selectedCodes.length === 1 && isRegionPackCode(selectedCodes[0]!)) {
      const regionCode = selectedCodes[0]!;
      const planName = planNameForRegionPackCode(regionCode);
      const regional =
        planName != null
          ? allProducts.filter((p) => p.plan_name.trim() === planName)
          : [];
      individual[regionCode] = packFromProducts(regional);
      return jsonWithLeakGuard({ individual, multi: [] }, "bongsim.products.by-country");
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

    return jsonWithLeakGuard({ individual, multi }, "bongsim.products.by-country");
  } catch (e) {
    console.error("[by-country]", e);
    return jsonWithLeakGuard(
      { error: "query failed" },
      "bongsim.products.by-country",
      { status: 500 },
    );
  }
}
