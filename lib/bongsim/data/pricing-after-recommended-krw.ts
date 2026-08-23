import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";
import {
  resolveActivePriceSide,
  type LoosePriceBlock,
} from "@/lib/bongsim/data/pricing-effective-from";

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
  | Pick<BongsimPriceBlockV1, "after" | "before" | "effective_from">
  | LoosePriceBlock;

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
 * 유효 판매가 — `effective_from` 전이면 before, 아니면 after.
 * 권장판매가 우선, 없으면 소비자가. slim JSON 필드명은 호환용 `consumer_krw`.
 * 봉심 스토어프론트 표시·정렬·체크아웃 청구 단가 SSOT.
 * REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 권장판매가 기준 + 명함 25% — manifest
 * REGRESSION-FREEZE[bongsim-price-effective-from]: Sept 1 cutover — manifest
 */
export function afterConsumerSellKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
  nowMs: number = Date.now(),
): number | null {
  const side = resolveActivePriceSide(priceBlock, nowMs);
  const v = side.recommended_krw ?? side.consumer_krw;
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}

/**
 * 유효 공급가 — effective_from 컷오버와 동일 규칙.
 * 어드민 원가 표시·마진 참고 SSOT.
 */
export function afterSupplyCostKrw(
  priceBlock: AfterRecommendedPriceBlockInput,
  nowMs: number = Date.now(),
): number | null {
  const v = resolveActivePriceSide(priceBlock, nowMs).supply_krw;
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}
