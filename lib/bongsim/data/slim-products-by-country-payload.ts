import type {
  CountryProductPack,
  ProductsByCountryResult,
} from "@/lib/bongsim/data/load-products-by-country";
import { collectTripDaysFromCountryPack } from "@/lib/bongsim/recommend/available-trip-days";
import { slimProductForRecommendApi } from "@/lib/bongsim/recommend/slim-recommend-api-product";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: by-country lite days+mins only — manifest

export type CountryProductPackLite = {
  roaming: { min_price: number; products: ProductOption[] };
  local: { min_price: number; products: ProductOption[] } | null;
  roaming_unlimited_min: number | null;
  local_unlimited_min: number | null;
  /** 플랜 칩용 — 상품 배열 없이 일수만 */
  available_days: number[];
};

function litePack(pack: CountryProductPack): CountryProductPackLite {
  return {
    roaming: {
      min_price: pack.roaming.min_price,
      products: [],
    },
    local: pack.local
      ? {
          min_price: pack.local.min_price,
          products: [],
        }
      : null,
    roaming_unlimited_min: pack.roaming_unlimited_min,
    local_unlimited_min: pack.local_unlimited_min,
    available_days: collectTripDaysFromCountryPack(pack),
  };
}

/**
 * recommend 핫패스 — 전체 SKU 배열 제거(수 MB·파싱 지연 방지).
 * PlanSelectPopup은 /plans 를 쓰므로 products 불필요.
 */
export function slimProductsByCountryForApi(
  res: Extract<ProductsByCountryResult, { ok: true }>,
): { individual: Record<string, CountryProductPackLite>; multi: ProductOption[] } {
  const individual: Record<string, CountryProductPackLite> = {};
  for (const [code, pack] of Object.entries(res.individual)) {
    individual[code] = litePack(pack);
  }
  return {
    individual,
    // multi는 비교 플로우용 — 슬림 필드만
    multi: res.multi.map(slimProductForRecommendApi),
  };
}
