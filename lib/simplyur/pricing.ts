import type { AfterRecommendedPriceBlockInput } from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { resolveActivePriceSide } from "@/lib/bongsim/data/pricing-effective-from";

// REGRESSION-FREEZE[simplyur-fx-daily-price]: catalog sell = consumer × 1.05 — manifest
// REGRESSION-FREEZE[bongsim-price-effective-from]: simplyur uses effective consumer — manifest

/** simplyur 판매가 = 유효 USIMSA 소비자가 × 5% 인상 (봉투어 소비자가 표시와 별개) */
export const SIMPLYUR_MARKUP_MULTIPLIER = 1.05;

export const SIMPLYUR_PRICE_BASIS_KEY = "after.consumer_krw.simplyur_markup_1.05" as const;

function effectiveUsimsaConsumerKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
  nowMs: number = Date.now(),
): number | null {
  const v = resolveActivePriceSide(priceBlock, nowMs).consumer_krw;
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}

/**
 * simplyur 청구·표시 단가(KRW): 유효 소비자가 × 1.05 (ceil). 표시 환율은 FX SSOT.
 * REGRESSION-FREEZE[bongsim-price-effective-from]: simplyur sell cutover — manifest
 */
export function simplyurSellPriceKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
  nowMs: number = Date.now(),
): number | null {
  const consumer = effectiveUsimsaConsumerKrw(priceBlock, nowMs);
  if (consumer == null || consumer < 0) return null;
  return Math.ceil(consumer * SIMPLYUR_MARKUP_MULTIPLIER);
}
