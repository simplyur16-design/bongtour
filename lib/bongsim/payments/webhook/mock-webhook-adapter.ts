import type { BongsimMockPaymentWebhookBodyV1 } from "@/lib/bongsim/contracts/payment-webhook.v1";
import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

const MOCK_PROVIDER = "bongsim_mock";

/** Production: secret required and must match (fail closed). Non-production: secret optional (local DX). */
export function verifyMockWebhookRequest(headers: Headers): boolean {
  const secret = process.env.BONGSIM_MOCK_WEBHOOK_SECRET?.trim();
  const h = headers.get("x-bongsim-mock-webhook-secret");
  if (isNodeProduction()) {
    if (!secret) return false;
    return h === secret;
  }
  if (!secret) return true;
  return h === secret;
}

export function parseMockWebhookBody(body: unknown): { ok: true; event: BongsimMockPaymentWebhookBodyV1 } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const o = body as Record<string, unknown>;
  if (o.schema !== "bongsim.payment_webhook.mock.v1") return { ok: false, error: "invalid_schema" };
  const provider_event_id = typeof o.provider_event_id === "string" ? o.provider_event_id.trim() : "";
  const payment_attempt_id = typeof o.payment_attempt_id === "string" ? o.payment_attempt_id.trim() : "";
  const outcome = o.outcome;
  if (!provider_event_id) return { ok: false, error: "missing_provider_event_id" };
  if (!payment_attempt_id) return { ok: false, error: "missing_payment_attempt_id" };
  if (outcome !== "authorized" && outcome !== "captured" && outcome !== "failed" && outcome !== "cancelled") {
    return { ok: false, error: "invalid_outcome" };
  }
  const amount_krw = typeof o.amount_krw === "number" ? o.amount_krw : typeof o.amount_krw === "string" ? Number.parseInt(String(o.amount_krw), 10) : undefined;
  const payment_reference = typeof o.payment_reference === "string" ? o.payment_reference.trim() : undefined;
  if (outcome === "captured" && (amount_krw == null || !Number.isFinite(amount_krw))) {
    return { ok: false, error: "amount_required_for_capture" };
  }
  return {
    ok: true,
    event: {
      schema: "bongsim.payment_webhook.mock.v1",
      provider_event_id,
      payment_attempt_id,
      outcome,
      amount_krw: amount_krw != null && Number.isFinite(amount_krw) ? Math.trunc(amount_krw) : undefined,
      payment_reference,
    },
  };
}

export function isMockProviderRoute(provider: string): boolean {
  return provider === MOCK_PROVIDER;
}

export { MOCK_PROVIDER as BONGSIM_MOCK_PAYMENT_PROVIDER_ID };
