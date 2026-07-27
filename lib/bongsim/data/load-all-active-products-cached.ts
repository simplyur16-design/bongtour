import { unstable_cache } from "next/cache";
import {
  fetchActiveProductOptionsForPlanNamesFromDb,
  fetchAllActiveProductOptionsFromDb,
  type AllActiveProductsResult,
} from "@/lib/bongsim/data/load-all-active-products";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";

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

export async function loadAllActiveProductsCached(): Promise<AllActiveProductsResult> {
  try {
    return await unstable_cache(fetchAllOrThrow, ["bongsim-all-active-products-v2"], {
      revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
      tags: ["bongsim-all-active-products", "bongsim-products-by-country"],
    })();
  } catch {
    return { ok: false, reason: "db_error" };
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
      ["bongsim-active-products-destination-v2", lc, planNames.join("|")],
      {
        revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
        tags: [
          "bongsim-active-products-destination",
          `bongsim-destination-${lc}`,
          "bongsim-products-by-country",
        ],
      },
    )();
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
