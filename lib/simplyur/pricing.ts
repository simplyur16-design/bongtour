import type { AfterRecommendedPriceBlockInput } from "@/lib/bongsim/data/pricing-after-recommended-krw";

// REGRESSION-FREEZE[simplyur-fx-daily-price]: catalog sell = consumer × 1.05 — manifest

/** simplyur 판매가 = after 소비자가 × 5% 인상 */
export const SIMPLYUR_MARKUP_MULTIPLIER = 1.05;

export const SIMPLYUR_PRICE_BASIS_KEY = "after.consumer_krw.simplyur_markup_1.05" as const;

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * simplyur 청구·표시 단가(KRW): `price_block.after.consumer_krw × 1.05` (ceil).
 * after.consumer_krw 없으면 null — recommended_krw 폴백 없음.
 */
export function simplyurSellPriceKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
): number | null {
  const consumer = numOrNull(priceBlock?.after?.consumer_krw);
  if (consumer == null || consumer < 0) return null;
  return Math.ceil(consumer * SIMPLYUR_MARKUP_MULTIPLIER);
}
