import type { AfterRecommendedPriceBlockInput } from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { afterConsumerSellKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";

// REGRESSION-FREEZE[simplyur-fx-daily-price]: catalog sell = consumer × 1.05 — manifest
// REGRESSION-FREEZE[bongsim-price-effective-from]: simplyur uses effective consumer — manifest

/** simplyur 판매가 = 유효 소비자가 × 5% 인상 */
export const SIMPLYUR_MARKUP_MULTIPLIER = 1.05;

export const SIMPLYUR_PRICE_BASIS_KEY = "after.consumer_krw.simplyur_markup_1.05" as const;

/**
 * simplyur 청구·표시 단가(KRW): 유효 소비자가 × 1.05 (ceil).
 * effective_from 컷오버는 afterConsumerSellKrw SSOT.
 */
export function simplyurSellPriceKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
): number | null {
  const consumer = afterConsumerSellKrw(priceBlock);
  if (consumer == null || consumer < 0) return null;
  return Math.ceil(consumer * SIMPLYUR_MARKUP_MULTIPLIER);
}
