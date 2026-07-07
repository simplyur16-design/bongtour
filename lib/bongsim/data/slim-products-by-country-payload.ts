import type {
  CountryProductPack,
  ProductsByCountryResult,
} from "@/lib/bongsim/data/load-products-by-country";
import { slimProductForRecommendApi } from "@/lib/bongsim/recommend/slim-recommend-api-product";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function slimPack(pack: CountryProductPack): CountryProductPack {
  const slimProducts = (arr: ProductOption[]) => arr.map(slimProductForRecommendApi);
  return {
    roaming: {
      min_price: pack.roaming.min_price,
      products: slimProducts(pack.roaming.products),
    },
    local: pack.local
      ? {
          min_price: pack.local.min_price,
          products: slimProducts(pack.local.products),
        }
      : null,
    roaming_unlimited_min: pack.roaming_unlimited_min,
    local_unlimited_min: pack.local_unlimited_min,
  };
}

/** API 응답 — recommend UI 필드만 (price_block 대부분 제거) */
export function slimProductsByCountryForApi(
  res: Extract<ProductsByCountryResult, { ok: true }>,
): { individual: Record<string, CountryProductPack>; multi: ProductOption[] } {
  const individual: Record<string, CountryProductPack> = {};
  for (const [code, pack] of Object.entries(res.individual)) {
    individual[code] = slimPack(pack);
  }
  return {
    individual,
    multi: res.multi.map(slimProductForRecommendApi),
  };
}
