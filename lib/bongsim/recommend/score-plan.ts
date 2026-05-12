import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import {
  isLocalNetwork,
  isUnlimitedPlan,
  parseNetworkGeneration,
  parseQosKbps,
  type NetworkGeneration,
} from "@/lib/bongsim/recommend/parse-speed";

export type PlanFeatures = {
  generation: NetworkGeneration;
  qosKbps: number | null;
  isLocal: boolean;
  isUnlimited: boolean;
};

export function extractPlanFeatures(option: BongsimProductOptionV1): PlanFeatures {
  return {
    generation: parseNetworkGeneration(option.network_raw),
    qosKbps: parseQosKbps(option.qos_raw),
    isLocal: isLocalNetwork(option.internet_raw, option.network_family),
    isUnlimited: isUnlimitedPlan(option.allowance_label, option.plan_type, option.plan_line_excel),
  };
}

/** 속도·망·무제한 가산, QOS kbps 가산, 소비자가(KRW) 약한 페널티. */
export function scorePlan(features: PlanFeatures, consumerKrw: number): number {
  let score = 0;

  switch (features.generation) {
    case "g5":
      score += 100;
      break;
    case "g4_lte":
      score += 60;
      break;
    case "g4":
      score += 30;
      break;
    default:
      break;
  }

  if (features.isLocal) score += 50;
  if (features.isUnlimited) score += 40;

  const q = features.qosKbps;
  if (q == null) {
    score += 10;
  } else if (q >= 5000) {
    score += 30;
  } else if (q >= 3000) {
    score += 20;
  } else if (q >= 1000) {
    score += 15;
  } else if (q === 384) {
    score += 3;
  } else if (q === 128) {
    score += 0;
  }

  const price = Number.isFinite(consumerKrw) ? consumerKrw : 0;
  score -= 0.003 * price;

  return score;
}
