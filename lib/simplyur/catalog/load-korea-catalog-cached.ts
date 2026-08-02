import { unstable_cache } from "next/cache";
import { closePgPool, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";
import {
  buildSimplyurKoreaPack,
  loadSimplyurKoreaActiveProducts,
  type SimplyurKoreaCatalogResult,
} from "@/lib/simplyur/catalog/load-korea-catalog";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 120s 캐시 — manifest
// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: DB 실패는 캐시하지 않음(throw)·locale 공유 — manifest

const CATALOG_REVALIDATE_SEC = 120;

const CATALOG_FAILURE_PREFIX = "simplyur_catalog_";

/** unstable_cache는 반환값만 캐시한다. 실패를 throw 해야 120초 동안 오류가 굳지 않는다. */
async function loadSimplyurKoreaProductsOrThrow(): Promise<ProductOption[]> {
  const res = await loadSimplyurKoreaActiveProducts();
  if (!res.ok) throw new Error(`${CATALOG_FAILURE_PREFIX}${res.reason}`);
  return res.products;
}

function reasonFromCacheError(e: unknown): "connection_timeout" | "db_unconfigured" | "db_error" {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes("connection_timeout")) return "connection_timeout";
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
    const products = await unstable_cache(loadSimplyurKoreaProductsOrThrow, ["simplyur-korea-products-v1"], {
      revalidate: CATALOG_REVALIDATE_SEC,
      tags: ["simplyur-catalog", "simplyur-korea-products"],
    })();
    return await mapProductsToCatalog(products, locale);
  } catch (e) {
    console.warn(
      "[loadSimplyurKoreaCatalogCached] cache miss; healing pool and retrying once",
      e instanceof Error ? e.message : e,
    );
    await probePgPoolTlsOrFallback();
    await closePgPool().catch(() => {});
    try {
      const products = await loadSimplyurKoreaProductsOrThrow();
      return await mapProductsToCatalog(products, locale);
    } catch (e2) {
      return { ok: false, reason: reasonFromCacheError(e2) };
    }
  }
}

export { CATALOG_REVALIDATE_SEC };
