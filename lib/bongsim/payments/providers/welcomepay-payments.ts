import type {
  BongsimPaymentProviderAdapter,
  BongsimPaymentProviderCreateInput,
  BongsimPaymentProviderCreateResult,
} from "@/lib/bongsim/payments/provider-types";
import { bongsimPath } from "@/lib/bongsim/constants";
import { generateOrderNumber } from "@/lib/bongsim/welcomepay";

/**
 * 웰컴페이먼츠 표준결제( INIStdPay ) — 세션 단계에서 PG 주문번호(oid) 확정 후 DB `provider_session_id`에 저장.
 */
export class WelcomepayPaymentsProvider implements BongsimPaymentProviderAdapter {
  readonly id = "welcomepay";

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
    if (!mid) {
      throw new Error("[welcomepay] WELCOMEPAY_MID is not configured");
    }
    const welcomeOid = generateOrderNumber(mid);
    const attemptIdStr = String(input.payment_attempt_id);
    const publicRef = `wp_${attemptIdStr.replace(/-/g, "").slice(0, 8)}`;
    const orderName = buildOrderName(input.order_number);

    const q = new URLSearchParams({
      paymentAttemptId: input.payment_attempt_id,
      orderId: input.order_id,
      ref: publicRef,
      welcomeOid,
      orderName,
      customerEmail: input.buyer_email,
      amount: String(input.amount_krw),
    });
    const redirectPath = `${bongsimPath("/checkout/payment/welcomepay")}?${q.toString()}`;

    return {
      provider_session_id: welcomeOid,
      client: {
        kind: "welcomepay_std",
        redirect_path: redirectPath,
        public_session_ref: publicRef,
        welcome_oid: welcomeOid,
        order_name: orderName,
        customer_email: input.buyer_email,
        amount_krw: input.amount_krw,
      },
    };
  }
}

function buildOrderName(orderNumber: string): string {
  const label = `Bong투어 eSIM 주문 ${orderNumber}`;
  return label.length > 100 ? label.slice(0, 100) : label;
}
