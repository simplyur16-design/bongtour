import { unstable_cache } from "next/cache";
import {
  fetchActiveProductOptionsForPlanNamesFromDb,
  fetchAllActiveProductOptionsFromDb,
  type AllActiveProductsResult,
} from "@/lib/bongsim/data/load-all-active-products";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";
import { healBongsimPgPoolForCatalog, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 전체·단일 목적지 120s cache — manifest

export const ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC = 120;

async function fetchAllOrThrow(): Promise<Extract<AllActiveProductsResult, { ok: true }>> {
  const res = await fetchAllActiveProductOptionsFromDb();
  if (!res.ok) throw new Error(`bongsim_catalog_${res.reason}`);
  return res;
}

async function fetchDestinationOrThrow(
  planNames: string[],
): Promise<Extract<AllActiveProductsResult, { ok: true }>> {
  const res = await fetchActiveProductOptionsForPlanNamesFromDb(planNames);
  if (!res.ok) throw new Error(`bongsim_catalog_${res.reason}`);
  return res;
}

function reasonFromCacheError(e: unknown): "connection_timeout" | "db_error" {
  const msg = String(e instanceof Error ? e.message : e);
  return msg.includes("connection_timeout") ? "connection_timeout" : "db_error";
}

/** unstable_cache 실패 후 풀 heal → 캐시 밖 1회 (국가별 cold miss 복구) */
async function retryCatalogOutsideCache(
  load: () => Promise<Extract<AllActiveProductsResult, { ok: true }>>,
  firstErr: unknown,
): Promise<AllActiveProductsResult> {
  console.warn(
    "[load-all-active-products-cached] cache miss; healing pool and retrying once",
    firstErr instanceof Error ? firstErr.message : firstErr,
  );
  await probePgPoolTlsOrFallback();
  await healBongsimPgPoolForCatalog("active-products-cache");
  try {
    return await load();
  } catch (e2) {
    return { ok: false, reason: reasonFromCacheError(e2) };
  }
}

export async function loadAllActiveProductsCached(): Promise<AllActiveProductsResult> {
  try {
    return await unstable_cache(fetchAllOrThrow, ["bongsim-all-active-products-v3"], {
      revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
      tags: ["bongsim-all-active-products", "bongsim-products-by-country"],
    })();
  } catch (e) {
    return retryCatalogOutsideCache(fetchAllOrThrow, e);
  }
}

/** 단일 codes=jp — plan_name SQL 필터 + 목적지별 cache */
export async function loadActiveProductsForDestinationCached(
  code: string,
): Promise<AllActiveProductsResult> {
  const lc = code.trim().toLowerCase();
  const planNames = resolveDestinationPlanNamesForSql(lc);
  if (!planNames) {
    return loadAllActiveProductsCached();
  }
  try {
    return await unstable_cache(
      () => fetchDestinationOrThrow(planNames),
      ["bongsim-active-products-destination-v3", lc, planNames.join("|")],
      {
        revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
        tags: [
          "bongsim-active-products-destination",
          `bongsim-destination-${lc}`,
          "bongsim-products-by-country",
        ],
      },
    )();
  } catch (e) {
    return retryCatalogOutsideCache(() => fetchDestinationOrThrow(planNames), e);
  }
}
