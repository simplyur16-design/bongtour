import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
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
  flags`;

const PRODUCT_OPTION_ORDER = `ORDER BY plan_name, days_raw, (price_block->'after'->>'recommended_krw')::numeric ASC NULLS LAST`;

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
      `${PRODUCT_OPTION_SELECT}
      FROM bongsim_product_option
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
      ${PRODUCT_OPTION_ORDER}`,
    );
    const products = (result.rows as unknown as ProductOption[]).map(attachRecommended);
    return { ok: true, products };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

/** DB — 단일 목적지 plan_name IN 필터 (codes=jp 등 cold path 가속) */
export async function fetchActiveProductOptionsForPlanNamesFromDb(
  planNames: string[],
): Promise<AllActiveProductsResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };
  if (planNames.length === 0) return { ok: true, products: [] };

  try {
    const result = await pool.query(
      `${PRODUCT_OPTION_SELECT}
      FROM bongsim_product_option
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
        AND plan_name = ANY($1::text[])
      ${PRODUCT_OPTION_ORDER}`,
      [planNames],
    );
    const products = (result.rows as unknown as ProductOption[]).map(attachRecommended);
    return { ok: true, products };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
