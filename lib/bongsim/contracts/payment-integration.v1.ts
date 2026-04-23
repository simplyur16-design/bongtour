import type { PaymentAttemptStatus } from "@/lib/bongsim/contracts/public-enums";

export type BongsimPaymentReturnUrlsV1 = {
  success_url: string;
  fail_url: string;
  cancel_url: string;
};

export type BongsimPaymentAttemptV1 = {
  payment_attempt_id: string;
  order_id: string;
  idempotency_key: string;
  created_at: string;
  status: PaymentAttemptStatus;
  provider: string;
  provider_session_id: string | null;
  provider_event_ids_seen: string[];
  amount_krw: number;
  currency: "KRW";
  return_context: { success_url: string; fail_url: string; cancel_url: string };
  last_error: { code: string | null; message: string | null; at: string | null };
};

export type BongsimPaymentWebhookIngestRulesV1 = {
  verify: Array<"signature" | "timestamp_skew" | "replay_id_unique">;
  map: {
    merchant_order_id: "order_id";
    payment_attempt_id: "optional";
    provider_event_id: string;
  };
  apply: "monotonic_payment_state_machine";
  side_effects: {
    on_captured: Array<"set_order_paid_idempotent" | "enqueue_fulfillment_once">;
    on_failed: Array<
      "mark_attempt_failed" | "leave_order_awaiting_payment_or_expire"
    >;
  };
};

export type BongsimPaymentIntegrationV1 = {
  schema: "bongsim.payment_integration.v1";
  binding: {
    merchant_order_id: string;
    merchant_order_number: string;
    buyer_email: string;
  };
  attempt: BongsimPaymentAttemptV1;
  webhook_ingest: BongsimPaymentWebhookIngestRulesV1;
  safety_invariants: string[];
};
