import type { BongsimOrderLineSnapshotV1 } from "@/lib/bongsim/contracts/order.v1";
import { afterSupplyCostKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";

/** 주문 라인 스냅샷에서 공급 원가(단가) — after.supply_krw SSOT */
export function supplyUnitKrwFromLineSnapshot(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const pb = (snapshot as BongsimOrderLineSnapshotV1).price_block;
  return afterSupplyCostKrw(pb);
}

export function supplyLineTotalKrw(snapshot: unknown, quantity: number): number | null {
  const unit = supplyUnitKrwFromLineSnapshot(snapshot);
  const qty = Math.trunc(quantity);
  if (unit == null || !Number.isFinite(qty) || qty < 1) return null;
  return unit * qty;
}
