import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import {
  classifyBongsimPgError,
  getPgPool,
  probePgPoolTlsOrFallback,
  resetBongsimPgPoolAfterConnectTimeout,
  withBongsimStatementTimeout,
} from "@/lib/bongsim/db/pool";
import { extractDaysFromDaysRaw } from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { isKoreaSingleCountryProduct } from "@/lib/simplyur/catalog/korea-product-filter";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type { SimplyurFxRates } from "@/lib/simplyur/currency";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";
import { toSimplyurPublicProduct, type SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { simplyurSellPriceKrw } from "@/lib/simplyur/pricing";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 DB 로더 — manifest
// REGRESSION-FREEZE[simplyur-fx-daily-price]: catalog uses resolveSimplyurFxRates — manifest
// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: statement timeout·connect timeout 분류·풀 리셋 — manifest

export type SimplyurKoreaPack = {
  roaming: {
    min_price_krw: number | null;
    min_display: SimplyurPublicProduct["simplyur_display"];
    products: SimplyurPublicProduct[];
  };
  local: {
    min_price_krw: number | null;
    min_display: SimplyurPublicProduct["simplyur_display"];
    products: SimplyurPublicProduct[];
  } | null;
};

export type SimplyurKoreaCatalogResult =
  | { ok: true; locale: SimplyurLocale; pack: SimplyurKoreaPack }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" };

function minSimplyurPrice(products: ProductOption[]): number | null {
  let min: number | null = null;
  for (const p of products) {
    const v = simplyurSellPriceKrw(p.price_block);
    if (v == null) continue;
    if (min == null || v < min) min = v;
  }
  return min;
}

function sortProducts(products: SimplyurPublicProduct[], source: ProductOption[]): SimplyurPublicProduct[] {
  const daysById = new Map(source.map((p) => [p.option_api_id, extractDaysFromDaysRaw(p.days_raw) ?? 9999]));
  return [...products].sort((a, b) => {
    const da = daysById.get(a.option_api_id) ?? 9999;
    const db = daysById.get(b.option_api_id) ?? 9999;
    if (da !== db) return da - db;
    const pa = a.simplyur_display?.amount ?? 999999999;
    const pb = b.simplyur_display?.amount ?? 999999999;
    return pa - pb;
  });
}

function packFromSingle(
  products: ProductOption[],
  locale: SimplyurLocale,
  rates: SimplyurFxRates,
): SimplyurKoreaPack {
  const roamingArr = products.filter((p) => (p.network_family || "").toLowerCase() === "roaming");
  const localArr = products.filter((p) => (p.network_family || "").toLowerCase() === "local");
  const roamingMapped = sortProducts(
    roamingArr.map((p) => toSimplyurPublicProduct(p, locale, rates)),
    roamingArr,
  );
  const localMapped = sortProducts(
    localArr.map((p) => toSimplyurPublicProduct(p, locale, rates)),
    localArr,
  );

  return {
    roaming: {
      min_price_krw: minSimplyurPrice(roamingArr),
      min_display: roamingMapped.find((p) => p.simplyur_display)?.simplyur_display ?? null,
      products: roamingMapped,
    },
    local:
      localArr.length > 0
        ? {
            min_price_krw: minSimplyurPrice(localArr),
            min_display: localMapped.find((p) => p.simplyur_display)?.simplyur_display ?? null,
            products: localMapped,
          }
        : null,
  };
}

export async function loadSimplyurKoreaCatalog(locale: SimplyurLocale): Promise<SimplyurKoreaCatalogResult> {
  await probePgPoolTlsOrFallback();
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  try {
    const rates = await resolveSimplyurFxRates();
    const result = await withBongsimStatementTimeout((client) =>
      client.query<ProductOption>(
        `SELECT option_api_id, plan_name, network_family, plan_type, days_raw,
              allowance_label, option_label, price_block, flags
       FROM bongsim_product_option
       WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
       ORDER BY plan_name, days_raw,
         (price_block->'after'->>'consumer_krw')::numeric ASC NULLS LAST`,
      ),
    );
    const koreaOnly = result.rows.filter(isKoreaSingleCountryProduct);
    return {
      ok: true,
      locale,
      pack: packFromSingle(koreaOnly, locale, rates),
    };
  } catch (e) {
    console.error("[loadSimplyurKoreaCatalog]", e);
    resetBongsimPgPoolAfterConnectTimeout(e);
    return { ok: false, reason: classifyBongsimPgError(e) };
  }
}

export async function loadSimplyurKoreaProductByOptionId(
  optionApiId: string,
  locale: SimplyurLocale,
): Promise<
  | { ok: true; product: SimplyurPublicProduct }
  | {
      ok: false;
      reason: "db_unconfigured" | "not_found" | "not_korea" | "db_error" | "connection_timeout";
    }
> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const id = optionApiId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  try {
    const rates = await resolveSimplyurFxRates();
    const result = await withBongsimStatementTimeout((client) =>
      client.query<ProductOption>(
        `SELECT option_api_id, plan_name, network_family, plan_type, days_raw,
              allowance_label, option_label, price_block, flags
       FROM bongsim_product_option
       WHERE option_api_id = $1 AND ${BONGSIM_CATALOG_ACTIVE_WHERE}
       LIMIT 1`,
        [id],
      ),
    );
    const row = result.rows[0];
    if (!row) return { ok: false, reason: "not_found" };
    if (!isKoreaSingleCountryProduct(row)) return { ok: false, reason: "not_korea" };
    return { ok: true, product: toSimplyurPublicProduct(row, locale, rates) };
  } catch (e) {
    console.error("[loadSimplyurKoreaProductByOptionId]", e);
    resetBongsimPgPoolAfterConnectTimeout(e);
    return { ok: false, reason: classifyBongsimPgError(e) };
  }
}
