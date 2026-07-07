import { unstable_cache } from "next/cache";
import {
  fetchActiveProductOptionsForPlanNamesFromDb,
  fetchAllActiveProductOptionsFromDb,
} from "@/lib/bongsim/data/load-all-active-products";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 전체·단일 목적지 120s cache — manifest

export const ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC = 120;

export function loadAllActiveProductsCached() {
  return unstable_cache(
    () => fetchAllActiveProductOptionsFromDb(),
    ["bongsim-all-active-products"],
    {
      revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
      tags: ["bongsim-all-active-products", "bongsim-products-by-country"],
    },
  )();
}

/** 단일 codes=jp — plan_name SQL 필터 + 목적지별 cache */
export function loadActiveProductsForDestinationCached(code: string) {
  const lc = code.trim().toLowerCase();
  const planNames = resolveDestinationPlanNamesForSql(lc);
  if (!planNames) {
    return loadAllActiveProductsCached();
  }
  return unstable_cache(
    () => fetchActiveProductOptionsForPlanNamesFromDb(planNames),
    ["bongsim-active-products-destination", lc, planNames.join("|")],
    {
      revalidate: ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC,
      tags: ["bongsim-active-products-destination", `bongsim-destination-${lc}`, "bongsim-products-by-country"],
    },
  )();
}
