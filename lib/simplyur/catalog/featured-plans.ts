import { parseQosKbps } from "@/lib/bongsim/recommend/parse-speed";
import { extractDaysFromDaysRaw, type ProductOption } from "@/lib/bongsim/recommend/product-option";

/**
 * 2026-11-21 사장님: "어차피 가장 낮은 하루짜리할사람 많지않다" — the 1-day / 500MB plans stay in the list
 * (and "from $1.03/day" stays), but representative plans that actually sell are shown first and flagged
 * `featured` (5-day unlimited first, then 3-day and 10-day).
 *
 * Representative for a trip length = regular Unlimited (not "완전 무제한"/Full unlimited) with the
 * highest speed cap — today the "Unlimited · up to 3 Mbps" row.
 * REGRESSION-FREEZE[simplyur-featured-plans]: featured first, rest keeps sortKoreaPlansBestFirst — manifest
 */
export const SIMPLYUR_FEATURED_TRIP_DAYS = [5, 3, 10] as const;

function isFullUnlimited(p: ProductOption): boolean {
  const c = (p.allowance_label ?? "").replace(/\s/g, "").toLowerCase();
  return c.includes("완전") || c.includes("full");
}

function isRegularUnlimited(p: ProductOption): boolean {
  if ((p.plan_type ?? "").trim().toLowerCase() !== "unlimited") return false;
  return !isFullUnlimited(p);
}

/** option_api_id of the representative plan per featured trip length, in featured order. */
export function pickFeaturedPlanIds(
  products: ProductOption[],
  days: readonly number[] = SIMPLYUR_FEATURED_TRIP_DAYS,
): string[] {
  const out: string[] = [];
  for (const d of days) {
    let best: ProductOption | null = null;
    let bestQos = -1;
    for (const p of products) {
      if (extractDaysFromDaysRaw(p.days_raw) !== d || !isRegularUnlimited(p)) continue;
      const q = parseQosKbps(p.qos_raw) ?? 0;
      if (q > bestQos) {
        best = p;
        bestQos = q;
      }
    }
    if (best) out.push(best.option_api_id);
  }
  return out;
}

/**
 * Featured plans move to the front (featured order); everything else keeps its existing order.
 * Clients that filter by trip length (app Plans, web /recommend) therefore show the featured plan
 * first for 5/3/10 days; the web home preview (first 3 rows) shows the three featured plans.
 */
export function orderFeaturedFirst(
  sorted: ProductOption[],
  days: readonly number[] = SIMPLYUR_FEATURED_TRIP_DAYS,
): { products: ProductOption[]; featuredIds: Set<string> } {
  const ids = pickFeaturedPlanIds(sorted, days);
  const featuredIds = new Set(ids);
  const byId = new Map(sorted.map((p) => [p.option_api_id, p] as const));
  const head = ids.map((id) => byId.get(id)!).filter(Boolean);
  const tail = sorted.filter((p) => !featuredIds.has(p.option_api_id));
  return { products: [...head, ...tail], featuredIds };
}
