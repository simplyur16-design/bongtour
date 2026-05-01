import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";

export type BongsimPaymentSessionRequestV1 = {
  schema: "bongsim.payment_session.request.v1";
  order_id: string;
  idempotency_key: string;
  /** Defaults to `bongsim_mock` when omitted. */
  provider?: string;
  return_urls: BongsimPaymentReturnUrlsV1;
};

/** Browser-safe payload only; no secrets, no webhook verification material. */
export type BongsimPaymentSessionClientV1 =
  | {
      kind: "mock_redirect";
      /** Same-origin safe path; UI may navigate or open WebView. */
      redirect_path: string;
      public_session_ref: string;
    }
  | {
      kind: "welcomepay_std";
      redirect_path: string;
      public_session_ref: string;
      /** PG 주문번호(oid) — `bongsim_payment_attempt.provider_session_id` 와 동일. */
      welcome_oid: string;
      order_name: string;
      customer_email: string;
      amount_krw: number;
    };

export type BongsimPaymentSessionResponseV1 = {
  schema: "bongsim.payment_session.response.v1";
  payment_attempt_id: string;
  order_id: string;
  order_number: string;
  provider: string;
  amount_krw: number;
  currency: "KRW";
  client: BongsimPaymentSessionClientV1;
  created_at: string;
  reused: boolean;
};

export type BongsimPaymentSessionErrorV1 = {
  schema: "bongsim.payment_session.error.v1";
  error: string;
  details?: Record<string, string>;
};
