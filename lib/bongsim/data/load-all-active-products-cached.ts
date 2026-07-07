import { unstable_cache } from "next/cache";
import { fetchAllActiveProductOptionsFromDb } from "@/lib/bongsim/data/load-all-active-products";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 단일 키 전체 카탈로그 120s cache — manifest

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
