import { bongsimPath } from "@/lib/bongsim/constants";
import type { BongsimPaymentProviderAdapter, BongsimPaymentProviderCreateInput, BongsimPaymentProviderCreateResult } from "@/lib/bongsim/payments/provider-types";

/**
 * Dummy provider: no external PG SDK. Webhook-first finalization still applies later.
 */
export class BongsimMockPaymentProvider implements BongsimPaymentProviderAdapter {
  readonly id = "bongsim_mock";

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const public_session_ref = `mock_${input.payment_attempt_id.slice(0, 8)}`;
    const provider_session_id = `mock_sess_${input.payment_attempt_id}`;
    const q = new URLSearchParams({
      paymentAttemptId: input.payment_attempt_id,
      orderId: input.order_id,
      ref: public_session_ref,
    });
    const redirect_path = `${bongsimPath("/checkout/payment/mock")}?${q.toString()}`;
    return {
      provider_session_id,
      client: { kind: "mock_redirect", redirect_path, public_session_ref },
    };
  }
}

/** Use `getPaymentProviderAdapter` from `@/lib/bongsim/payments/payment-provider-registry` (PG 교체 지점). */
