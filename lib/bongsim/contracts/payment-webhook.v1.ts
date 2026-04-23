/** Inbound mock-provider webhook (no vendor SDK). */
export type BongsimMockPaymentWebhookBodyV1 = {
  schema: "bongsim.payment_webhook.mock.v1";
  provider_event_id: string;
  payment_attempt_id: string;
  outcome: "authorized" | "captured" | "failed" | "cancelled";
  /** Required when outcome is `captured` (validated against order total). */
  amount_krw?: number;
  /** Stored on successful capture. */
  payment_reference?: string;
};

export type BongsimPaymentWebhookAckV1 = {
  schema: "bongsim.payment_webhook.ack.v1";
  ok: true;
  duplicate?: boolean;
};

export type BongsimPaymentWebhookErrorV1 = {
  schema: "bongsim.payment_webhook.error.v1";
  ok: false;
  error: string;
};
