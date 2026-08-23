import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";
import {
  AFTER_CONSUMER_BASIS_KEY,
  afterConsumerSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";

// REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest

/**
 * 봉심 웹 체크아웃 청구 단가 — 스토어프론트 표시와 동일하게 `afterConsumerSellKrw`.
 * 봉투어 정가(공급가×5/3, slim 필드는 consumer_krw 호환). 명함 승인 할인은 confirm 시 subtotal 기준 % 차감.
 */
export function selectChargedUnitPriceKrw(priceBlock: BongsimPriceBlockV1): {
  basis_key: string;
  unit_krw: number;
} {
  const unit = afterConsumerSellKrw(priceBlock);
  if (unit != null && Number.isFinite(unit) && unit >= 0) {
    return { basis_key: AFTER_CONSUMER_BASIS_KEY, unit_krw: unit };
  }
  return { basis_key: "missing_all_price_cells", unit_krw: 0 };
}
