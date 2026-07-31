import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";

export type BongsimPaymentSessionRequestV1 = {
  schema: "bongsim.payment_session.request.v1";
  order_id: string;
  idempotency_key: string;
  /** Defaults to `bongsim_mock` when omitted. */
  provider?: string;
  return_urls: BongsimPaymentReturnUrlsV1;
  /** simplyur PortOne — PayPal or KICC (required when provider=portone) */
  simplyur_portone_method?: "paypal" | "kicc_wechat" | "kicc_alipay_plus";
  /** simplyur checkout UI locale for KICC payment window */
  simplyur_locale?: string;
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
      kind: "portone_v2";
      public_session_ref: string;
      store_id: string;
      channel_key: string;
      payment_id: string;
      order_name: string;
      /** USD minor units charged via PortOne (PayPal / KICC). */
      total_amount_minor: number;
      charge_currency: "USD";
      portone_method: "paypal" | "kicc_wechat" | "kicc_alipay_plus";
      customer_email: string;
      is_test_channel: boolean;
      /** KICC locale (e.g. EN_US). Omitted for PayPal. */
      portone_locale?: string;
      /** PortOne async settlement (KICC QR flows). */
      notice_url?: string;
    }
  | {
      kind: "eximbay_v2";
      public_session_ref: string;
      sdk_script_url: string;
      /** Exact payload for EXIMBAY.request_pay (fgkey + ready body). No API secret. */
      request_pay: {
        fgkey: string;
        payment: {
          transaction_type: "PAYMENT";
          order_id: string;
          currency: "USD";
          amount: string;
          lang: string;
        };
        merchant: { mid: string };
        buyer: { name: string; email: string };
        url: { return_url: string; status_url: string };
      };
      order_name: string;
      customer_email: string;
      is_test: boolean;
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
