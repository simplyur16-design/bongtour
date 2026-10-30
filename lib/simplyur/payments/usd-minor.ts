// REGRESSION-FREEZE[simplyur-fx-daily-price]: USD minor uses resolveSimplyurFxRates — manifest
// Moved unchanged from portone-methods.ts (PortOne removed 2026-10-30) — Eximbay USD charge SSOT.

import { getSimplyurFxRates, krwToDisplayAmount, type SimplyurFxRates } from "@/lib/simplyur/currency";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";

/** Eximbay USD charge — minor units (e.g. $1.50 → 150). */
export function krwOrderTotalToUsdMinor(krw: number, rates?: SimplyurFxRates): number {
  if (!Number.isFinite(krw) || krw <= 0) return 1;
  const usd = krwToDisplayAmount(krw, "USD", rates ?? getSimplyurFxRates());
  return Math.max(1, Math.round(usd * 100));
}

/** Same as `krwOrderTotalToUsdMinor` with server FX snapshot (12h cache). */
export async function krwOrderTotalToUsdMinorResolved(krw: number): Promise<number> {
  const rates = await resolveSimplyurFxRates();
  return krwOrderTotalToUsdMinor(krw, rates);
}
