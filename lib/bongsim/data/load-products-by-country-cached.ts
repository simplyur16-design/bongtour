import {
  filterProductsByCountry,
  type ProductsByCountryResult,
} from "@/lib/bongsim/data/load-products-by-country";
import {
  loadActiveProductsForDestinationCached,
  loadAllActiveProductsCached,
} from "@/lib/bongsim/data/load-all-active-products-cached";

// REGRESSION-FREEZE[bongsim-products-by-country-cache]: 단일 카탈로그 cache + SQL 단일목적지 — manifest

export { ALL_ACTIVE_PRODUCTS_REVALIDATE_SEC as PRODUCTS_BY_COUNTRY_REVALIDATE_SEC } from "@/lib/bongsim/data/load-all-active-products-cached";

export async function loadProductsByCountryCached(codes: string[]): Promise<ProductsByCountryResult> {
  const normalized = [...codes].map((c) => c.trim().toLowerCase()).filter(Boolean).sort();

  const catalog =
    normalized.length === 1
      ? await loadActiveProductsForDestinationCached(normalized[0]!)
      : await loadAllActiveProductsCached();

  if (!catalog.ok) return catalog;
  return filterProductsByCountry(catalog.products, normalized);
}
