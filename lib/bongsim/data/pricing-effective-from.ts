import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";

/**
 * 2026-09-01 00:00 KST (= 2026-08-31 15:00 UTC) — USIMSA 20260901 공급가 컷오버.
 * REGRESSION-FREEZE[bongsim-price-effective-from]: Sept 1 00:00 KST — manifest
 */
export const BONGSIM_PRICE_EFFECTIVE_FROM_20260901 = "2026-09-01T00:00:00+09:00";

export type PriceTriple = {
  consumer_krw: number | null;
  recommended_krw: number | null;
  supply_krw: number | null;
};

/** DB JSON·API·ProductOption — 숫자/문자/unknown 혼재 허용 (출력은 PriceTriple) */
export type LoosePriceTripleInput = {
  consumer_krw?: unknown;
  recommended_krw?: unknown;
  supply_krw?: unknown;
};

export type LoosePriceBlock =
  | Pick<BongsimPriceBlockV1, "before" | "after" | "effective_from">
  | {
      before?: LoosePriceTripleInput | Partial<PriceTriple> | null;
      after?: LoosePriceTripleInput | Partial<PriceTriple> | null;
      effective_from?: string | null;
    }
  | null
  | undefined;

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tripleFrom(side: LoosePriceTripleInput | Partial<PriceTriple> | null | undefined): PriceTriple {
  return {
    consumer_krw: numOrNull(side?.consumer_krw),
    recommended_krw: numOrNull(side?.recommended_krw),
    supply_krw: numOrNull(side?.supply_krw),
  };
}

export function priceTripleHasAny(t: PriceTriple): boolean {
  return t.consumer_krw != null || t.recommended_krw != null || t.supply_krw != null;
}

/** effective_from 이 있고 아직 전이면 true → before 사용 */
export function isBeforePriceEffectiveWindow(
  priceBlock: LoosePriceBlock,
  nowMs: number = Date.now(),
): boolean {
  const raw = String(priceBlock?.effective_from ?? "").trim();
  if (!raw) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return nowMs < t;
}

/**
 * 표시·청구에 쓸 before/after 쪽.
 * REGRESSION-FREEZE[bongsim-price-effective-from]
 */
export function resolveActivePriceSide(
  priceBlock: LoosePriceBlock,
  nowMs: number = Date.now(),
): PriceTriple {
  const before = tripleFrom(priceBlock?.before ?? undefined);
  const after = tripleFrom(priceBlock?.after ?? undefined);
  if (isBeforePriceEffectiveWindow(priceBlock, nowMs)) {
    return priceTripleHasAny(before) ? before : after;
  }
  return priceTripleHasAny(after) ? after : before;
}
