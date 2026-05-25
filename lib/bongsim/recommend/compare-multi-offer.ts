import {
  computeRecommendedPrice,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import {
  classifyPlanSpeedTier,
  type PlanSpeedTier,
} from "@/lib/bongsim/recommend/plan-speed-tier";

export type CompareCountryPlanSelection = { product: ProductOption; quantity: number };

export type MultiTierCheapest = {
  tier: PlanSpeedTier;
  product: ProductOption;
  priceKrw: number;
};

export type CompareMultiJudgment =
  | { kind: "hidden" }
  | {
      kind: "recommend";
      offer: MultiTierCheapest;
    }
  | {
      kind: "alternative";
      offer: MultiTierCheapest;
    };

const FASTER_MAX_RATIO = 1.2;
const ALT_MAX_RATIO = 0.8;
/** (b) 다운그레이드: allowance_label 용량 GB 환산 기준 최소 (500MB=0.5 제외) */
const ALT_MIN_CAPACITY_GB = 3;

function unitPrice(product: ProductOption): number | null {
  if (typeof product.recommended_price === "number" && Number.isFinite(product.recommended_price)) {
    return product.recommended_price;
  }
  return computeRecommendedPrice(product.price_block);
}

/** 다국가 매칭 풀에서 등급별 최저 소비자가 1건 */
export function cheapestPerSpeedTier(plans: ProductOption[]): MultiTierCheapest[] {
  const best = new Map<PlanSpeedTier, MultiTierCheapest>();
  for (const product of plans) {
    const tier = classifyPlanSpeedTier(product);
    if (tier == null) continue;
    const priceKrw = unitPrice(product);
    if (priceKrw == null) continue;
    const prev = best.get(tier);
    if (!prev || priceKrw < prev.priceKrw) {
      best.set(tier, { tier, product, priceKrw });
    }
  }
  return [...best.values()].sort((a, b) => b.tier - a.tier);
}

export function maxIndividualSpeedTier(
  selectedCodes: string[],
  completed: Record<string, CompareCountryPlanSelection>,
): PlanSpeedTier | null {
  const tiers: PlanSpeedTier[] = [];
  for (const code of selectedCodes) {
    const p = completed[code]?.product;
    if (!p) continue;
    const t = classifyPlanSpeedTier(p);
    if (t != null) tiers.push(t);
  }
  if (tiers.length === 0) return null;
  return Math.max(...tiers) as PlanSpeedTier;
}

type OfferSlot = "a" | "b" | "hidden";

/**
 * 등급 비교 후 가격 가드 (1.2 / 1.0 / 0.8).
 * - tier > 개별최상위: 가격 <= 합계×1.2 → a, 초과 → hidden
 * - tier == 개별최상위: 가격 <= 합계 → a, 초과 → hidden
 * - tier == 개별최상위-1: 가격 <= 합계×0.8 → b, 초과 → hidden
 * - tier <= 개별최상위-2: hidden
 */
function classifyOfferSlot(
  offer: MultiTierCheapest,
  individualMax: PlanSpeedTier,
  individualTotal: number,
): OfferSlot {
  const { tier, priceKrw } = offer;
  if (tier <= individualMax - 2) return "hidden";
  if (tier > individualMax) {
    return priceKrw <= individualTotal * FASTER_MAX_RATIO ? "a" : "hidden";
  }
  if (tier === individualMax) {
    return priceKrw <= individualTotal ? "a" : "hidden";
  }
  if (tier === individualMax - 1) {
    return priceKrw <= individualTotal * ALT_MAX_RATIO ? "b" : "hidden";
  }
  return "hidden";
}

function pickCheapest(offers: MultiTierCheapest[]): MultiTierCheapest | null {
  if (offers.length === 0) return null;
  return offers.reduce((a, b) => (a.priceKrw <= b.priceKrw ? a : b));
}

const RE_ALLOWANCE_GB = /(\d+(?:\.\d+)?)\s*gb\b/i;
const RE_ALLOWANCE_MB = /(\d+(?:\.\d+)?)\s*mb\b/i;

/** allowance_label → GB (500MB=0.5, 3GB=3 …). 파싱 불가 시 null. */
export function allowanceCapacityGb(product: ProductOption): number | null {
  const s = String(product.allowance_label ?? "").trim();
  if (!s) return null;
  const gb = s.match(RE_ALLOWANCE_GB);
  if (gb) {
    const n = parseFloat(gb[1]!);
    return Number.isFinite(n) ? n : null;
  }
  const mb = s.match(RE_ALLOWANCE_MB);
  if (mb) {
    const n = parseFloat(mb[1]!);
    return Number.isFinite(n) ? n / 1000 : null;
  }
  return null;
}

/**
 * (b) 1단계 아래: gb>=3 중 최대 용량(동률이면 최저가). 없거나 가격>합계×0.8 → null.
 * 등급별 최저가(500MB)는 사용하지 않음.
 */
function pickAlternativeDowngradeOffer(
  plans: ProductOption[],
  individualMax: PlanSpeedTier,
  individualTotal: number,
): MultiTierCheapest | null {
  const oneBelow = (individualMax - 1) as PlanSpeedTier;
  if (oneBelow < 1) return null;

  const eligible: MultiTierCheapest[] = [];
  for (const product of plans) {
    const tier = classifyPlanSpeedTier(product);
    if (tier !== oneBelow) continue;
    const gb = allowanceCapacityGb(product);
    if (gb == null || gb < ALT_MIN_CAPACITY_GB) continue;
    const priceKrw = unitPrice(product);
    if (priceKrw == null) continue;
    eligible.push({ tier, product, priceKrw });
  }
  if (eligible.length === 0) return null;

  const maxGb = Math.max(...eligible.map((o) => allowanceCapacityGb(o.product)!));
  const atMaxGb = eligible.filter((o) => allowanceCapacityGb(o.product)! === maxGb);
  const picked = atMaxGb.reduce((a, b) => (a.priceKrw <= b.priceKrw ? a : b));

  if (picked.priceKrw > individualTotal * ALT_MAX_RATIO) return null;
  return picked;
}

/**
 * (a) 후보(등급·가격 통과) 중 최저가 → 없으면 (b) 1단계 아래 gb>=3 최대 용량.
 */
export function judgeCompareMultiOffer(
  individualMaxTier: PlanSpeedTier | null,
  individualTotalKrw: number | null,
  multiPlans: ProductOption[],
): CompareMultiJudgment {
  if (individualMaxTier == null || individualTotalKrw == null || individualTotalKrw <= 0) {
    return { kind: "hidden" };
  }

  const byTier = cheapestPerSpeedTier(multiPlans);
  if (byTier.length === 0) return { kind: "hidden" };

  const aCandidates: MultiTierCheapest[] = [];

  for (const offer of byTier) {
    const slot = classifyOfferSlot(offer, individualMaxTier, individualTotalKrw);
    if (slot === "a") aCandidates.push(offer);
  }

  const recommend = pickCheapest(aCandidates);
  if (recommend) return { kind: "recommend", offer: recommend };

  const alternative = pickAlternativeDowngradeOffer(
    multiPlans,
    individualMaxTier,
    individualTotalKrw,
  );
  if (alternative) return { kind: "alternative", offer: alternative };

  return { kind: "hidden" };
}

export function pickDefaultCompareChoice(
  judgment: CompareMultiJudgment,
  individualTotalKrw: number | null,
): "individual" | "multi" {
  if (judgment.kind === "hidden" || individualTotalKrw == null) return "individual";
  const multiPrice = judgment.offer.priceKrw;
  return multiPrice < individualTotalKrw ? "multi" : "individual";
}

/** (a) 추천 시 가격 문구 — 저렴 / 더 빠른데 +N원 */
export function recommendPriceMessage(
  individualTotalKrw: number,
  multiPriceKrw: number,
  multiTier: PlanSpeedTier,
  individualMaxTier: PlanSpeedTier,
): string | null {
  if (multiPriceKrw <= individualTotalKrw) {
    return `${formatKrwMessage(individualTotalKrw - multiPriceKrw)} 저렴`;
  }
  if (multiTier > individualMaxTier) {
    return `더 빠른데 +${formatKrwMessage(multiPriceKrw - individualTotalKrw)}`;
  }
  return null;
}

function formatKrwMessage(n: number): string {
  return `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
}
