import { unstable_cache } from "next/cache";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import {
  loadSimplyurKoreaCatalog,
  type SimplyurKoreaCatalogResult,
} from "@/lib/simplyur/catalog/load-korea-catalog";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 120s 캐시 — manifest
// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: DB 실패는 캐시하지 않음(throw) — manifest

const CATALOG_REVALIDATE_SEC = 120;

const CATALOG_FAILURE_PREFIX = "simplyur_catalog_";

/** unstable_cache는 반환값만 캐시한다. 실패를 throw 해야 120초 동안 오류가 굳지 않는다. */
async function loadSimplyurKoreaCatalogOrThrow(
  locale: SimplyurLocale,
): Promise<Extract<SimplyurKoreaCatalogResult, { ok: true }>> {
  const res = await loadSimplyurKoreaCatalog(locale);
  if (!res.ok) throw new Error(`${CATALOG_FAILURE_PREFIX}${res.reason}`);
  return res;
}

export async function loadSimplyurKoreaCatalogCached(
  locale: SimplyurLocale,
): Promise<SimplyurKoreaCatalogResult> {
  try {
    return await unstable_cache(
      () => loadSimplyurKoreaCatalogOrThrow(locale),
      ["simplyur-korea-catalog", locale],
      { revalidate: CATALOG_REVALIDATE_SEC, tags: [`simplyur-catalog-${locale}`] },
    )();
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}

export { CATALOG_REVALIDATE_SEC };
