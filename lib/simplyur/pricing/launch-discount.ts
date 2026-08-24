import { afterSupplyCostKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";
import {
  resolveActivePriceSide,
  type LoosePriceBlock,
} from "@/lib/bongsim/data/pricing-effective-from";

/**
 * Simplyur launch first-purchase discount.
 * 14% of list (consumer × 1.05) lands on/above USIMSA 권장소비자가 (~0.90 × consumer).
 * 15% would sell below MAP on every Korea SKU. Bongsim first-purchase stays 15%.
 * REGRESSION-FREEZE[simplyur-launch-discount-14pct]: 14% + 권장소비자가·마진 바닥 — manifest
 */
export const SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT = 14;

/** Eximbay fee per payment (KRW) — operator cost model. */
export const SIMPLYUR_LAUNCH_PG_FEE_KRW = 600;

/** CS 10% of supply + profit 15% of supply. */
export const SIMPLYUR_LAUNCH_MIN_MULTIPLE_ON_SUPPLY = 1.25;

export type SimplyurLaunchDiscountLineInput = {
  list_krw: number;
  quantity: number;
  recommended_krw: number | null;
  supply_krw: number | null;
};

export function simplyurLaunchFloorInputsFromPriceBlock(
  priceBlock: LoosePriceBlock,
  nowMs: number = Date.now(),
): { recommended_krw: number | null; supply_krw: number | null } {
  const rec = resolveActivePriceSide(priceBlock, nowMs).recommended_krw;
  const recommended_krw = rec != null && rec >= 0 ? Math.trunc(rec) : null;
  return {
    recommended_krw,
    supply_krw: afterSupplyCostKrw(priceBlock, nowMs),
  };
}

/** min_sell = max(권장소비자가, supply×1.25 + PG 600) */
export function simplyurLaunchMinSellKrw(opts: {
  recommended_krw: number | null;
  supply_krw: number | null;
}): number {
  const rec =
    opts.recommended_krw != null && Number.isFinite(opts.recommended_krw) && opts.recommended_krw > 0
      ? Math.trunc(opts.recommended_krw)
      : 0;
  const supply =
    opts.supply_krw != null && Number.isFinite(opts.supply_krw) && opts.supply_krw > 0
      ? Math.trunc(opts.supply_krw)
      : 0;
  const marginFloor =
    supply > 0 ? Math.ceil(supply * SIMPLYUR_LAUNCH_MIN_MULTIPLE_ON_SUPPLY + SIMPLYUR_LAUNCH_PG_FEE_KRW) : 0;
  return Math.max(rec, marginFloor);
}

/**
 * Per-unit discount. Skip extra discount when 14% would go below the 15%-of-supply+PG floor
 * (cheap 1-day SKUs). Never sell below 권장소비자가 when list is already at/above it.
 */
export function computeSimplyurLaunchUnitDiscountKrw(opts: {
  list_krw: number;
  recommended_krw: number | null;
  supply_krw: number | null;
}): number {
  const list = Math.trunc(opts.list_krw);
  if (!Number.isFinite(list) || list <= 0) return 0;

  const rec =
    opts.recommended_krw != null && Number.isFinite(opts.recommended_krw) && opts.recommended_krw > 0
      ? Math.trunc(opts.recommended_krw)
      : 0;
  const supply =
    opts.supply_krw != null && Number.isFinite(opts.supply_krw) && opts.supply_krw > 0
      ? Math.trunc(opts.supply_krw)
      : 0;
  const marginFloor =
    supply > 0 ? Math.ceil(supply * SIMPLYUR_LAUNCH_MIN_MULTIPLE_ON_SUPPLY + SIMPLYUR_LAUNCH_PG_FEE_KRW) : 0;
  const minSell = Math.max(rec, marginFloor);
  if (minSell > list) return 0;

  const raw = Math.floor((list * SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT) / 100);
  const rawNet = list - raw;
  if (marginFloor > 0 && rawNet < marginFloor) return 0;

  const net = rec > 0 ? Math.max(rawNet, rec) : rawNet;
  return Math.max(0, list - net);
}

export function computeSimplyurLaunchDiscountKrw(lines: SimplyurLaunchDiscountLineInput[]): number {
  let total = 0;
  for (const line of lines) {
    const qty = Math.trunc(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    total += computeSimplyurLaunchUnitDiscountKrw(line) * qty;
  }
  return total;
}

export function computeSimplyurLaunchDiscountForCheckoutLines(
  lines: Array<{ unit_krw: number; quantity: number; price_block: LoosePriceBlock }>,
  nowMs: number = Date.now(),
): number {
  return computeSimplyurLaunchDiscountKrw(
    lines.map((line) => {
      const floors = simplyurLaunchFloorInputsFromPriceBlock(line.price_block, nowMs);
      return {
        list_krw: line.unit_krw,
        quantity: line.quantity,
        recommended_krw: floors.recommended_krw,
        supply_krw: floors.supply_krw,
      };
    }),
  );
}
