import type {
  BongsimPaymentProviderAdapter,
  BongsimPaymentProviderCreateInput,
  BongsimPaymentProviderCreateResult,
} from "@/lib/bongsim/payments/provider-types";
import { buildSimplyurPortonePaymentId } from "@/lib/simplyur/payments/portone-payment-id";
import { resolvePortoneEnv } from "@/lib/simplyur/payments/portone-env";

export const SIMPLYUR_PORTONE_PROVIDER_ID = "portone" as const;

function simplyurOrderName(orderNumber: string): string {
  return `simplyur Korea eSIM (${orderNumber})`;
}

/**
 * simplyur PortOne V2 — paymentId 확정 후 browser SDK `requestPayment`에 전달.
 * REGRESSION-FREEZE[simplyur-portone-checkout-p2]: simplyur PG adapter — manifest
 */
export class SimplyurPortonePaymentsProvider implements BongsimPaymentProviderAdapter {
  readonly id = SIMPLYUR_PORTONE_PROVIDER_ID;

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const resolved = resolvePortoneEnv();
    if (!resolved.ok) {
      throw new Error(`[simplyur:portone] missing env: ${resolved.missing.join(", ")}`);
    }

    const paymentId = buildSimplyurPortonePaymentId(input.order_number, input.payment_attempt_id);
    const publicRef = `po_${input.payment_attempt_id.replace(/-/g, "").slice(0, 8)}`;

    return {
      provider_session_id: paymentId,
      client: {
        kind: "portone_v2",
        public_session_ref: publicRef,
        store_id: resolved.env.storeId,
        channel_key: resolved.env.channelKey,
        payment_id: paymentId,
        order_name: simplyurOrderName(input.order_number),
        total_amount_krw: input.amount_krw,
        currency: "CURRENCY_KRW",
        customer_email: input.buyer_email,
        is_test_channel: resolved.env.isTestChannel,
      },
    };
  }
}
