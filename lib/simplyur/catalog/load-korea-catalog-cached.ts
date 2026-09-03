import { unstable_cache } from "next/cache";
import {
  healBongsimPgPoolForCatalog,
  isBongsimPgSaturatedMaxClients,
  shouldSkipCatalogHealBecauseSaturated,
} from "@/lib/bongsim/db/pool";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";
import { toSimplyurPublicProduct } from "@/lib/simplyur/public-product";
import {
  buildSimplyurKoreaPack,
  findKoreaCatalogProductByOptionId,
  loadSimplyurKoreaActiveProducts,
  loadSimplyurKoreaProductByOptionId,
  type SimplyurKoreaCatalogResult,
} from "@/lib/simplyur/catalog/load-korea-catalog";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 120s 캐시 — manifest
// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: DB 실패는 캐시하지 않음(throw)·locale 공유 — manifest
// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: korea products cache v2 after plan_name SQL — manifest
// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: detail reads simplyur-korea-products-v2 first — manifest

const CATALOG_REVALIDATE_SEC = 120;

const CATALOG_FAILURE_PREFIX = "simplyur_catalog_";

const KOREA_PRODUCTS_CACHE_KEY = "simplyur-korea-products-v2";

/** unstable_cache는 반환값만 캐시한다. 실패를 throw 해야 120초 동안 오류가 굳지 않는다. */
async function loadSimplyurKoreaProductsOrThrow(): Promise<ProductOption[]> {
  const res = await loadSimplyurKoreaActiveProducts();
  if (!res.ok) throw new Error(`${CATALOG_FAILURE_PREFIX}${res.reason}`);
  return res.products;
}

function cachedKoreaProducts() {
  return unstable_cache(loadSimplyurKoreaProductsOrThrow, [KOREA_PRODUCTS_CACHE_KEY], {
    revalidate: CATALOG_REVALIDATE_SEC,
    tags: ["simplyur-catalog", "simplyur-korea-products"],
  })();
}

function reasonFromCacheError(e: unknown): "connection_timeout" | "db_unconfigured" | "db_error" {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes("connection_timeout") || /EMAXCONN|max client connections reached/i.test(msg)) {
    return "connection_timeout";
  }
  if (msg.includes("db_unconfigured")) return "db_unconfigured";
  return "db_error";
}

async function mapProductsToCatalog(
  products: ProductOption[],
  locale: SimplyurLocale,
): Promise<Extract<SimplyurKoreaCatalogResult, { ok: true }>> {
  const rates = await resolveSimplyurFxRates();
  return {
    ok: true,
    locale,
    pack: buildSimplyurKoreaPack(products, locale, rates),
  };
}

/**
 * Locale별 pack은 캐시하지 않고, Korea SKU DB 결과만 공유 캐시.
 * (이전: locale마다 cold miss → en만 되고 vi/zh-TW db_error)
 */
export async function loadSimplyurKoreaCatalogCached(
  locale: SimplyurLocale,
): Promise<SimplyurKoreaCatalogResult> {
  try {
    const products = await cachedKoreaProducts();
    return await mapProductsToCatalog(products, locale);
  } catch (e) {
    if (isBongsimPgSaturatedMaxClients(e)) {
      shouldSkipCatalogHealBecauseSaturated(e);
      return { ok: false, reason: "connection_timeout" };
    }
    console.warn(
      "[loadSimplyurKoreaCatalogCached] cache miss; healing pool and retrying once",
      e instanceof Error ? e.message : e,
    );
    await healBongsimPgPoolForCatalog(e);
    try {
      const products = await loadSimplyurKoreaProductsOrThrow();
      return await mapProductsToCatalog(products, locale);
    } catch (e2) {
      return { ok: false, reason: reasonFromCacheError(e2) };
    }
  }
}

/**
 * 앱·웹 상세·체크아웃 — 목록과 같은 Korea 캐시에서 찾고, 없을 때만 DB.
 * 목록은 캐시인데 상세가 매번 DB를 치면 EMAXCONN → Plan not found.
 */
export async function loadSimplyurKoreaProductByOptionIdCached(
  optionApiId: string,
  locale: SimplyurLocale,
): ReturnType<typeof loadSimplyurKoreaProductByOptionId> {
  const id = optionApiId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  try {
    const products = await cachedKoreaProducts();
    const row = findKoreaCatalogProductByOptionId(products, id);
    if (row) {
      const rates = await resolveSimplyurFxRates();
      return { ok: true, product: toSimplyurPublicProduct(row, locale, rates) };
    }
  } catch (e) {
    console.warn(
      "[loadSimplyurKoreaProductByOptionIdCached] cache miss; falling back to DB",
      e instanceof Error ? e.message : e,
    );
  }

  let loaded = await loadSimplyurKoreaProductByOptionId(id, locale);
  if (!loaded.ok && loaded.reason === "connection_timeout") {
    await healBongsimPgPoolForCatalog("simplyur-product-detail");
    loaded = await loadSimplyurKoreaProductByOptionId(id, locale);
  }
  return loaded;
}

export { CATALOG_REVALIDATE_SEC };
