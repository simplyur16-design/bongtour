import { unstable_cache } from "next/cache";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import {
  loadSimplyurKoreaCatalog,
  type SimplyurKoreaCatalogResult,
} from "@/lib/simplyur/catalog/load-korea-catalog";

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: 카탈로그 120s 캐시 — manifest

const CATALOG_REVALIDATE_SEC = 120;

async function loadSimplyurKoreaCatalogCachedInner(
  locale: SimplyurLocale,
): Promise<SimplyurKoreaCatalogResult> {
  return loadSimplyurKoreaCatalog(locale);
}

export function loadSimplyurKoreaCatalogCached(
  locale: SimplyurLocale,
): Promise<SimplyurKoreaCatalogResult> {
  return unstable_cache(
    () => loadSimplyurKoreaCatalogCachedInner(locale),
    ["simplyur-korea-catalog", locale],
    { revalidate: CATALOG_REVALIDATE_SEC, tags: [`simplyur-catalog-${locale}`] },
  )();
}

export { CATALOG_REVALIDATE_SEC };
