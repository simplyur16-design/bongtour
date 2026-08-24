import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { classifyPlanSpeedTier } from "@/lib/bongsim/recommend/plan-speed-tier";
import { parseQosKbps } from "@/lib/bongsim/recommend/parse-speed";
import {
  extractDaysFromDaysRaw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { simplyurSellPriceKrw } from "@/lib/simplyur/pricing";

// REGRESSION-FREEZE[simplyur-plans-best-capacity-first]: 같은 일수 — 좋은 플랜(무제한·고용량) 위, 낮은 용량 아래 — manifest

function isFullUnlimitedLabel(allowanceLabel: string): boolean {
  const compact = allowanceLabel.replace(/\s/g, "").toLowerCase();
  return compact.includes("완전") || compact.includes("full");
}

function capacityMb(p: ProductOption): number {
  if (isTrueUnlimited(p)) return Number.POSITIVE_INFINITY;
  const parsed = parseAllowance(p.allowance_label);
  if (parsed.kind === "unlimited") return Number.POSITIVE_INFINITY;
  if (parsed.kind === "mb") return parsed.mb;
  return 0;
}

function sellPrice(p: ProductOption): number {
  return simplyurSellPriceKrw(p.price_block) ?? Number.POSITIVE_INFINITY;
}

/** 같은 여행일수 안: 속도등급↓ → 완전무제한 → 용량↓ → QoS↓ → 가격↑ */
export function compareKoreaPlansBestFirst(a: ProductOption, b: ProductOption): number {
  const da = extractDaysFromDaysRaw(a.days_raw) ?? 9999;
  const db = extractDaysFromDaysRaw(b.days_raw) ?? 9999;
  if (da !== db) return da - db;

  const ta = classifyPlanSpeedTier(a) ?? 0;
  const tb = classifyPlanSpeedTier(b) ?? 0;
  if (ta !== tb) return tb - ta;

  const fa = isFullUnlimitedLabel(a.allowance_label) ? 1 : 0;
  const fb = isFullUnlimitedLabel(b.allowance_label) ? 1 : 0;
  if (fa !== fb) return fb - fa;

  const ca = capacityMb(a);
  const cb = capacityMb(b);
  if (ca !== cb) return cb - ca;

  const qa = parseQosKbps(a.qos_raw) ?? 0;
  const qb = parseQosKbps(b.qos_raw) ?? 0;
  if (qa !== qb) return qb - qa;

  return sellPrice(a) - sellPrice(b);
}

export function sortKoreaPlansBestFirst(products: ProductOption[]): ProductOption[] {
  return [...products].sort(compareKoreaPlansBestFirst);
}
