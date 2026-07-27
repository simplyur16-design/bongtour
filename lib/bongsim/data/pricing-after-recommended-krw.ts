import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";

export const AFTER_RECOMMENDED_BASIS_KEY = "after.recommended_krw" as const;
export const AFTER_CONSUMER_BASIS_KEY = "after.consumer_krw" as const;

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** DB JSON·API 조회 등 느슨한 `price_block` 형태도 허용 */
export type AfterRecommendedPriceBlockInput =
  | Pick<BongsimPriceBlockV1, "after">
  | {
      after?: {
        recommended_krw?: unknown;
        consumer_krw?: unknown;
        supply_krw?: unknown;
      } | null;
    }
  | null
  | undefined;

/**
 * 변동 후(after) 권장판매가 — before·소비자가·공급가 폴백 없음.
 * (어드민·레거시 참고용. 봉심 스토어프론트 표시·청구는 `afterConsumerSellKrw`)
 */
export function afterRecommendedSellKrw(priceBlock: AfterRecommendedPriceBlockInput): number | null {
  const v = numOrNull(priceBlock?.after?.recommended_krw);
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}

/**
 * 변동 후(after) 소비자가만 — before·권장판매가·공급가 폴백 없음.
 * 봉심 스토어프론트 표시·정렬·체크아웃 청구 단가 SSOT.
 * REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest
 */
export function afterConsumerSellKrw(priceBlock: AfterRecommendedPriceBlockInput): number | null {
  const v = numOrNull(priceBlock?.after?.consumer_krw);
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}

/**
 * 변동 후(after) 공급가만 — before·권장판매가 폴백 없음.
 * 어드민 원가 표시·마진 참고 SSOT.
 */
export function afterSupplyCostKrw(priceBlock: AfterRecommendedPriceBlockInput): number | null {
  const v = numOrNull(priceBlock?.after?.supply_krw);
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}
