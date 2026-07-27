import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool, withBongsimStatementTimeout } from "@/lib/bongsim/db/pool";
import { computeRecommendedPrice } from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: active 카탈로그 DB SSOT — manifest

export type AllActiveProductsResult =
  | { ok: true; products: ProductOption[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

const PRODUCT_OPTION_SELECT = `SELECT 
  option_api_id,
  plan_name,
  network_family,
  plan_type,
  days_raw,
  allowance_label,
  option_label,
  price_block,
  flags
FROM bongsim_product_option`;

function attachRecommended(row: ProductOption): ProductOption {
  const rp = computeRecommendedPrice(row.price_block);
  return {
    ...row,
    recommended_price: rp ?? undefined,
  };
}

function sortCatalogProducts(products: ProductOption[]): ProductOption[] {
  return [...products].sort((a, b) => {
    const byName = a.plan_name.localeCompare(b.plan_name, "ko");
    if (byName !== 0) return byName;
    const byDays = String(a.days_raw ?? "").localeCompare(String(b.days_raw ?? ""), "en", {
      numeric: true,
    });
    if (byDays !== 0) return byDays;
    const pa = a.recommended_price ?? Number.POSITIVE_INFINITY;
    const pb = b.recommended_price ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
}

/** DB — 판매 중 eSIM 옵션 전체 (국가 필터 없음) */
export async function fetchAllActiveProductOptionsFromDb(): Promise<AllActiveProductsResult> {
  if (!getPgPool()) return { ok: false, reason: "db_unconfigured" };

  try {
    const result = await withBongsimStatementTimeout((client) =>
      client.query(
        `${PRODUCT_OPTION_SELECT}
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}`,
      ),
    );
    const products = sortCatalogProducts(
      (result.rows as unknown as ProductOption[]).map(attachRecommended),
    );
    return { ok: true, products };
  } catch (e) {
    console.error("[fetchAllActiveProductOptionsFromDb]", e);
    return { ok: false, reason: "db_error" };
  }
}

/** DB — 단일 목적지 plan_name IN 필터 (codes=jp 등 cold path 가속) */
export async function fetchActiveProductOptionsForPlanNamesFromDb(
  planNames: string[],
): Promise<AllActiveProductsResult> {
  if (!getPgPool()) return { ok: false, reason: "db_unconfigured" };
  if (planNames.length === 0) return { ok: true, products: [] };

  try {
    const result = await withBongsimStatementTimeout((client) =>
      client.query(
        `${PRODUCT_OPTION_SELECT}
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
        AND plan_name = ANY($1::text[])`,
        [planNames],
      ),
    );
    const products = sortCatalogProducts(
      (result.rows as unknown as ProductOption[]).map(attachRecommended),
    );
    return { ok: true, products };
  } catch (e) {
    console.error("[fetchActiveProductOptionsForPlanNamesFromDb]", e);
    return { ok: false, reason: "db_error" };
  }
}
