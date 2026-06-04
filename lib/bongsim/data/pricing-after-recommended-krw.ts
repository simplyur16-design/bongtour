import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";

export const AFTER_RECOMMENDED_BASIS_KEY = "after.recommended_krw" as const;

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type AfterRecommendedBlock = Pick<BongsimPriceBlockV1, "after"> | { after?: BongsimPriceBlockV1["after"] } | null | undefined;

/**
 * 변동 후(after) 권장판매가만 — before·소비자가·공급가 폴백 없음.
 * 스토어프론트 표시·정렬·결제 단가 SSOT.
 */
export function afterRecommendedSellKrw(priceBlock: AfterRecommendedBlock): number | null {
  const v = numOrNull(priceBlock?.after?.recommended_krw);
  if (v == null || v < 0) return null;
  return Math.trunc(v);
}
