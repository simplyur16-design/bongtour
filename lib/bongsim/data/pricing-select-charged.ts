import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";
import {
  AFTER_RECOMMENDED_BASIS_KEY,
  afterRecommendedSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";

// REGRESSION-FREEZE[bongsim-charge-after-recommended-krw]: 체크아웃 청구 = 표시 after.recommended_krw — manifest

/**
 * 봉심 웹 체크아웃 청구 단가 — 스토어프론트 표시와 동일하게 `after.recommended_krw` 만.
 * (소비자가 consumer_krw 로 청구하면 11700 표시 → 13000 결제 같은 괴리 발생)
 */
export function selectChargedUnitPriceKrw(priceBlock: BongsimPriceBlockV1): {
  basis_key: string;
  unit_krw: number;
} {
  const unit = afterRecommendedSellKrw(priceBlock);
  if (unit != null && Number.isFinite(unit) && unit >= 0) {
    return { basis_key: AFTER_RECOMMENDED_BASIS_KEY, unit_krw: unit };
  }
  return { basis_key: "missing_all_price_cells", unit_krw: 0 };
}
