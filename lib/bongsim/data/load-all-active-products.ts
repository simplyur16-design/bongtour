import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { computeRecommendedPrice } from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 전체 active 카탈로그 SSOT — manifest

export type AllActiveProductsResult =
  | { ok: true; products: ProductOption[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

function attachRecommended(row: ProductOption): ProductOption {
  const rp = computeRecommendedPrice(row.price_block);
  return {
    ...row,
    recommended_price: rp ?? undefined,
  };
}

/** DB — 판매 중 eSIM 옵션 전체 (국가 필터 없음) */
export async function fetchAllActiveProductOptionsFromDb(): Promise<AllActiveProductsResult> {
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
    const products = (result.rows as unknown as ProductOption[]).map(attachRecommended);
    return { ok: true, products };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
