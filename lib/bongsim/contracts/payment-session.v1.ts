import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";

export type BongsimPaymentSessionRequestV1 = {
  schema: "bongsim.payment_session.request.v1";
  order_id: string;
  idempotency_key: string;
  /** Defaults to `bongsim_mock` when omitted. */
  provider?: string;
  return_urls: BongsimPaymentReturnUrlsV1;
  /** simplyur checkout UI locale for Eximbay lang */
  simplyur_locale?: string;
  /**
   * Eximbay payment window form factor.
   * M = mobile UI + redirect (default for Simplyur). P = PC popup.
   */
  eximbay_ostype?: "M" | "P";
  /**
   * Eximbay ready transaction_type.
   * PAYMENT = full window (web). PAYER_AUTH = auth only then server confirm (mobile).
   */
  eximbay_transaction_type?: "PAYMENT" | "PAYER_AUTH";
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
    }
  | {
      kind: "eximbay_v2";
      public_session_ref: string;
      sdk_script_url: string;
      /** Exact payload for EXIMBAY.request_pay (fgkey + ready body). No API secret. */
      request_pay: {
        fgkey: string;
        payment: {
          transaction_type: "PAYMENT" | "PAYER_AUTH";
          order_id: string;
          currency: "USD";
          amount: string;
          lang: string;
        };
        merchant: { mid: string };
        buyer: { name: string; email: string };
        url: { return_url: string; status_url: string };
        settings: {
          ostype: "P" | "M";
          display_type: "P" | "R";
          call_from_app?: "Y" | "N";
          call_from_scheme?: string;
        };
        other?: { multi_paymethod: string };
      };
      order_name: string;
      customer_email: string;
      is_test: boolean;
      /** Present when transaction_type is PAYER_AUTH — app must call complete-pa after auth. */
      auth_only?: boolean;
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
