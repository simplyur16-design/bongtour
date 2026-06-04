import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";
import {
  AFTER_RECOMMENDED_BASIS_KEY,
  afterRecommendedSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";

/** Server-only charged unit: after.recommended_krw only (변동 후 권장판매가). */
export function selectChargedUnitPriceKrw(priceBlock: BongsimPriceBlockV1): { basis_key: string; unit_krw: number } {
  const v = afterRecommendedSellKrw(priceBlock);
  if (v != null) return { basis_key: AFTER_RECOMMENDED_BASIS_KEY, unit_krw: v };
  return { basis_key: "missing_after_recommended_krw", unit_krw: 0 };
}
