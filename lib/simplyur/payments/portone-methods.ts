// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PayPal + KICC method SSOT — manifest
// REGRESSION-FREEZE[simplyur-fx-daily-price]: USD minor uses resolveSimplyurFxRates — manifest

import { getSimplyurFxRates, krwToDisplayAmount, type SimplyurFxRates } from "@/lib/simplyur/currency";
import { resolveSimplyurFxRates } from "@/lib/simplyur/fx-rates";

/** simplyur 해외 PG — PortOne V2 채널별 결제 수단 */
export type SimplyurPortoneMethod = "paypal" | "kicc_wechat" | "kicc_alipay_plus";

export const SIMPLYUR_PORTONE_METHODS: readonly SimplyurPortoneMethod[] = [
  "paypal",
  "kicc_wechat",
  "kicc_alipay_plus",
] as const;

export function parseSimplyurPortoneMethod(raw: unknown): SimplyurPortoneMethod | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as SimplyurPortoneMethod;
  return SIMPLYUR_PORTONE_METHODS.includes(s) ? s : null;
}

/** PortOne `totalAmount` for USD — minor units (e.g. $1.50 → 150). */
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

export function isSimplyurPortonePaymentId(paymentId: string): boolean {
  return paymentId.trim().startsWith("su-");
}

export function listConfiguredPortoneMethods(
  channelKeyFor: (method: SimplyurPortoneMethod) => string | null,
): SimplyurPortoneMethod[] {
  const out: SimplyurPortoneMethod[] = [];
  if (channelKeyFor("paypal")) out.push("paypal");
  if (channelKeyFor("kicc_wechat")) {
    out.push("kicc_wechat", "kicc_alipay_plus");
  }
  return out;
}
