import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { isTrueUnlimited } from "@/lib/bongsim/recommend/product-option";
import { parseQosKbps } from "@/lib/bongsim/recommend/parse-speed";

/**
 * 속도 등급 사다리 SSOT (숫자 클수록 상위).
 * 무5M(4) > 데일리(3) > 무1M(2) > 종량제(1)
 */
export type PlanSpeedTier = 1 | 2 | 3 | 4;

export const PLAN_SPEED_TIER_LABEL: Record<PlanSpeedTier, string> = {
  1: "종량제",
  2: "무제한(1M)",
  3: "데일리",
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
  if (pt === "daily") return 3;
  if (pt === "unlimited") {
    if (isTrueUnlimited(product) && isQos5Mbps(product.qos_raw)) return 4;
    if (isTrueUnlimited1MbpsPlus(product)) return 2;
    if (isTrueUnlimited(product)) return 2;
    return 2;
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
