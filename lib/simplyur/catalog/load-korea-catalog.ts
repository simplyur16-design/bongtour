import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { BONGSIM_CATALOG_USIMSA_CONSUMER_KRW_SQL } from "@/lib/bongsim/data/catalog-consumer-krw-sql";
import {
  classifyBongsimPgError,
  getPgPool,
  resetBongsimPgPoolAfterConnectTimeout,
  withBongsimCatalogRetry,
  withBongsimStatementTimeout,
} from "@/lib/bongsim/db/pool";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import {
  isKoreaSingleCountryProduct,
  koreaCatalogPlanNamesForSql,
} from "@/lib/simplyur/catalog/korea-product-filter";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type { SimplyurFxRates } from "@/lib/simplyur/currency";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";
import { toSimplyurPublicProduct, type SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { simplyurSellPriceKrw } from "@/lib/simplyur/pricing";
import { sortKoreaPlansBestFirst } from "@/lib/simplyur/catalog/sort-korea-plans";
import { orderFeaturedFirst } from "@/lib/simplyur/catalog/featured-plans";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 DB 로더 — manifest
// REGRESSION-FREEZE[simplyur-fx-daily-price]: catalog uses resolveSimplyurFxRates — manifest
// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: statement timeout·connect timeout 분류·풀 리셋 — manifest
// REGRESSION-FREEZE[simplyur-plan-unlimited-hint]: SELECT qos_raw for Unlimited 1/3Mbps labels — manifest
// REGRESSION-FREEZE[bongsim-price-effective-from]: catalog ORDER BY effective consumer — manifest
// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: Korea plan_name SQL so 15k+ catalog cannot empty the app list — manifest
// REGRESSION-FREEZE[simplyur-plans-best-capacity-first]: pack order = sortKoreaPlansBestFirst — manifest
// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: list·detail share findKoreaCatalogProductByOptionId — manifest

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

export type SimplyurKoreaProductsResult =
  | { ok: true; products: ProductOption[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" };

/**
 * min_display must be the display of the cheapest plan (same rule as min_price_krw).
 * It used to be the first mapped product (best-capacity-first order), which showed
 * $3.08 while min_price_krw already pointed at the $1.03 plan.
 */
function minSimplyurDisplay(
  products: ProductOption[],
  mapped: SimplyurPublicProduct[],
): SimplyurPublicProduct["simplyur_display"] {
  let best: SimplyurPublicProduct["simplyur_display"] = null;
  let bestKrw: number | null = null;
  for (let i = 0; i < products.length; i++) {
    const display = mapped[i]?.simplyur_display;
    if (!display) continue;
    const krw = simplyurSellPriceKrw(products[i].price_block);
    if (krw == null) continue;
    if (bestKrw == null || krw < bestKrw) {
      bestKrw = krw;
      best = display;
    }
  }
  return best;
}

function minSimplyurPrice(products: ProductOption[]): number | null {
  let min: number | null = null;
  for (const p of products) {
    const v = simplyurSellPriceKrw(p.price_block);
    if (v == null) continue;
    if (min == null || v < min) min = v;
  }
  return min;
}

/** Locale/FX 매핑 — DB 캐시와 분리 (en 워밍이 vi/zh-TW cold miss를 살림) */
export function buildSimplyurKoreaPack(
  products: ProductOption[],
  locale: SimplyurLocale,
  rates: SimplyurFxRates,
): SimplyurKoreaPack {
  const roamingSorted = orderFeaturedFirst(
    sortKoreaPlansBestFirst(
      products.filter((p) => (p.network_family || "").toLowerCase() === "roaming"),
    ),
  );
  const localSorted = orderFeaturedFirst(
    sortKoreaPlansBestFirst(
      products.filter((p) => (p.network_family || "").toLowerCase() === "local"),
    ),
  );
  const roamingArr = roamingSorted.products;
  const localArr = localSorted.products;
  const mapWithFeatured = (p: ProductOption, featured: Set<string>) => {
    const m = toSimplyurPublicProduct(p, locale, rates);
    return featured.has(p.option_api_id) ? { ...m, featured: true } : m;
  };
  const roamingMapped = roamingArr.map((p) => mapWithFeatured(p, roamingSorted.featuredIds));
  const localMapped = localArr.map((p) => mapWithFeatured(p, localSorted.featuredIds));

  return {
    roaming: {
      min_price_krw: minSimplyurPrice(roamingArr),
      min_display: minSimplyurDisplay(roamingArr, roamingMapped),
      products: roamingMapped,
    },
    local:
      localArr.length > 0
        ? {
            min_price_krw: minSimplyurPrice(localArr),
            min_display: minSimplyurDisplay(localArr, localMapped),
            products: localMapped,
          }
        : null,
  };
}

/** Korea SKU rows only — locale 무관 SSOT (unstable_cache 공유 키) */
export async function loadSimplyurKoreaActiveProducts(): Promise<SimplyurKoreaProductsResult> {
  // probe는 instrumentation 기동 시 1회 — 핫패스 SELECT 1 금지.
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const koreaPlanNames = koreaCatalogPlanNamesForSql();

  try {
    const result = await withBongsimCatalogRetry(() =>
      withBongsimStatementTimeout((client) =>
        client.query<ProductOption>(
          `SELECT option_api_id, plan_name, network_family, plan_type, days_raw,
              allowance_label, option_label, qos_raw, price_block, flags
       FROM bongsim_product_option
       WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
         AND TRIM(plan_name) = ANY($1::text[])
       ORDER BY plan_name, days_raw,
         (${BONGSIM_CATALOG_USIMSA_CONSUMER_KRW_SQL}) ASC NULLS LAST`,
          [koreaPlanNames],
        ),
      ),
    );
    return {
      ok: true,
      products: result.rows.filter(isKoreaSingleCountryProduct),
    };
  } catch (e) {
    console.error("[loadSimplyurKoreaActiveProducts]", e);
    await resetBongsimPgPoolAfterConnectTimeout(e);
    return { ok: false, reason: classifyBongsimPgError(e) };
  }
}

export async function loadSimplyurKoreaCatalog(locale: SimplyurLocale): Promise<SimplyurKoreaCatalogResult> {
  const rates = await resolveSimplyurFxRates();
  const loaded = await loadSimplyurKoreaActiveProducts();
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    locale,
    pack: buildSimplyurKoreaPack(loaded.products, locale, rates),
  };
}

/** 목록에 나온 SKU를 상세가 다시 찾지 못할 때 쓰는 동일 키. UUID 대소문자만 달라도 매칭. */
export function findKoreaCatalogProductByOptionId(
  products: ProductOption[],
  optionApiId: string,
): ProductOption | undefined {
  const id = optionApiId.trim();
  if (!id) return undefined;
  const exact = products.find((p) => p.option_api_id === id);
  if (exact) return exact;
  const lower = id.toLowerCase();
  return products.find((p) => p.option_api_id.toLowerCase() === lower);
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
    const result = await withBongsimCatalogRetry(() =>
      withBongsimStatementTimeout((client) =>
        client.query<ProductOption>(
          `SELECT option_api_id, plan_name, network_family, plan_type, days_raw,
              allowance_label, option_label, qos_raw, price_block, flags
       FROM bongsim_product_option
       WHERE option_api_id = $1 AND ${BONGSIM_CATALOG_ACTIVE_WHERE}
       LIMIT 1`,
          [id],
        ),
      ),
    );
    const row = result.rows[0];
    if (!row) return { ok: false, reason: "not_found" };
    if (!isKoreaSingleCountryProduct(row)) return { ok: false, reason: "not_korea" };
    return { ok: true, product: toSimplyurPublicProduct(row, locale, rates) };
  } catch (e) {
    console.error("[loadSimplyurKoreaProductByOptionId]", e);
    await resetBongsimPgPoolAfterConnectTimeout(e);
    return { ok: false, reason: classifyBongsimPgError(e) };
  }
}
