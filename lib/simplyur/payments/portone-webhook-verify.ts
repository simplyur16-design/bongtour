// REGRESSION-FREEZE[simplyur-portone-webhook-secret]: PortOne webhook signature verify — manifest

import {
  verify as verifyPortoneWebhook,
  WebhookVerificationError,
  type Webhook,
} from "@portone/server-sdk/webhook";
import { resolvePortoneWebhookSecret, resolvePortoneWebhookSecretFormat } from "@/lib/simplyur/payments/portone-env";

export type ParsedPortoneWebhook =
  | { ok: true; verified: boolean; type: string; paymentId: string | null }
  | { ok: false; reason: "invalid_signature" | "invalid_payload" };

function headersForVerify(headers: Headers): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function paymentIdFromWebhook(webhook: Webhook): string | null {
  if (webhook.type !== "Transaction.Paid") return null;
  const id = webhook.data?.paymentId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function parseUnverifiedJson(rawBody: string): ParsedPortoneWebhook {
  try {
    const payload = JSON.parse(rawBody) as { type?: string; data?: { paymentId?: string } };
    const type = typeof payload.type === "string" ? payload.type : "";
    const paymentId =
      typeof payload.data?.paymentId === "string" && payload.data.paymentId.trim()
        ? payload.data.paymentId.trim()
        : null;
    return { ok: true, verified: false, type, paymentId };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}

/** Verify Standard Webhooks signature when `PORTONE_WEBHOOK_SECRET` is set; else JSON-only (dev). */
export async function parseSimplyurPortoneWebhook(
  rawBody: string,
  headers: Headers,
): Promise<ParsedPortoneWebhook> {
  const secret = resolvePortoneWebhookSecret();
  if (!secret) {
    return parseUnverifiedJson(rawBody);
  }

  const format = resolvePortoneWebhookSecretFormat();
  try {
    const webhook = await verifyPortoneWebhook(secret, rawBody, headersForVerify(headers), {
      ...(format === "raw" ? { format: "raw" as const } : {}),
    });
    return {
      ok: true,
      verified: true,
      type: webhook.type,
      paymentId: paymentIdFromWebhook(webhook),
    };
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return { ok: false, reason: "invalid_signature" };
    }
    return { ok: false, reason: "invalid_payload" };
  }
}
