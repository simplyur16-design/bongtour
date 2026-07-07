import { unstable_cache } from "next/cache";
import { loadProductsByCountry } from "@/lib/bongsim/data/load-products-by-country";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: by-country API 120s cache — manifest

export const PRODUCTS_BY_COUNTRY_REVALIDATE_SEC = 120;

export function loadProductsByCountryCached(codes: string[]) {
  const normalized = [...codes].map((c) => c.trim().toLowerCase()).filter(Boolean).sort();
  const key = normalized.join(",");
  return unstable_cache(() => loadProductsByCountry(normalized), ["bongsim-products-by-country", key], {
    revalidate: PRODUCTS_BY_COUNTRY_REVALIDATE_SEC,
    tags: ["bongsim-products-by-country"],
  })();
}
