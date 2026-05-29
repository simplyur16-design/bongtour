import { allowanceCapacityGb } from "@/lib/bongsim/recommend/compare-multi-offer";
import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { computeRecommendedPrice, isTrueUnlimited } from "@/lib/bongsim/recommend/product-option";
import { parseQosKbps } from "@/lib/bongsim/recommend/parse-speed";

/**
 * 속도 등급 사다리 SSOT (숫자 클수록 상위).
 * 무5M(4) > 무1M(3) > 데일리(2) > 종량제(1)
 */
export type PlanSpeedTier = 1 | 2 | 3 | 4;

export const PLAN_SPEED_TIER_LABEL: Record<PlanSpeedTier, string> = {
  1: "종량제",
  2: "데일리",
  3: "무제한(1M)",
  4: "무제한(5M)",
};

/** plans API `isQos5MbpsForPremium` 와 동일 패턴 */
export function isQos5Mbps(qos_raw: string | null | undefined): boolean {
  const s = (qos_raw || "").trim().toLowerCase();
  if (!s) return false;
  return /(?<![0-9.])5\s*mbps\b/.test(s);
}

/** 진짜 무제한 + QOS 1Mbps 이상 (5Mbps 제외 시 무1M 등급) */
function isTrueUnlimited1MbpsPlus(product: ProductOption): boolean {
  if (!isTrueUnlimited(product)) return false;
  if (isQos5Mbps(product.qos_raw)) return false;
  const kbps = parseQosKbps(product.qos_raw);
  return kbps == null || kbps >= 1000;
}

/**
 * 상품 1건 → 속도 등급. plan_type·qos_raw·allowance(진짜 무제한) 기준.
 */
export function classifyPlanSpeedTier(product: ProductOption): PlanSpeedTier | null {
  const pt = (product.plan_type || "").trim().toLowerCase();
  if (pt === "fixed") return 1;
  if (pt === "daily") return 2;
  if (pt === "unlimited") {
    if (isTrueUnlimited(product) && isQos5Mbps(product.qos_raw)) return 4;
    if (isTrueUnlimited1MbpsPlus(product)) return 3;
    if (isTrueUnlimited(product)) return 3;
    return 3;
  }
  return null;
}

export function maxPlanSpeedTier(tiers: Iterable<PlanSpeedTier | null | undefined>): PlanSpeedTier | null {
  let max: PlanSpeedTier | null = null;
  for (const t of tiers) {
    if (t == null) continue;
    if (max == null || t > max) max = t;
  }
  return max;
}

export type PlanRecSource = "unlimited" | "daily" | "fixed";

function tierToRecSource(tier: PlanSpeedTier): PlanRecSource {
  if (tier === 1) return "fixed";
  if (tier === 2) return "daily";
  return "unlimited";
}

function unitPriceKrw(product: ProductOption): number | null {
  if (typeof product.recommended_price === "number" && Number.isFinite(product.recommended_price)) {
    return product.recommended_price;
  }
  return computeRecommendedPrice(product.price_block);
}

function capacityScoreGb(product: ProductOption): number {
  const gb = allowanceCapacityGb(product);
  if (gb != null) return gb;
  if (isTrueUnlimited(product)) return Number.POSITIVE_INFINITY;
  const parsed = parseAllowance(product.allowance_label);
  if (parsed.kind === "mb") return parsed.mb / 1024;
  if (parsed.kind === "unlimited") return Number.POSITIVE_INFINITY;
  return -1;
}

/**
 * 속도 등급 최상위 → 동등급 내 용량 큰 것 → 동용량 저가.
 * plans API 추천 핀 SSOT.
 */
export function pickRecommendedBySpeedTier(
  plans: ProductOption[],
): (ProductOption & { rec_source: PlanRecSource }) | null {
  type Candidate = { product: ProductOption; tier: PlanSpeedTier; price: number };
  const candidates: Candidate[] = [];
  for (const product of plans) {
    const tier = classifyPlanSpeedTier(product);
    const price = unitPriceKrw(product);
    if (tier == null || price == null) continue;
    candidates.push({ product, tier, price });
  }
  if (candidates.length === 0) return null;

  const maxTier = Math.max(...candidates.map((c) => c.tier)) as PlanSpeedTier;
  const atMax = candidates.filter((c) => c.tier === maxTier);
  atMax.sort((a, b) => {
    const capDiff = capacityScoreGb(b.product) - capacityScoreGb(a.product);
    if (capDiff !== 0) return capDiff;
    return a.price - b.price;
  });

  const winner = atMax[0]!;
  return { ...winner.product, rec_source: tierToRecSource(winner.tier) };
}
