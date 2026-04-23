import { randomUUID } from "node:crypto";
import { processMockPaymentWebhook } from "@/lib/bongsim/data/process-payment-webhook";
import { processNextOrderPaidOutbox } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { getPgPool } from "@/lib/bongsim/db/pool";
import type { BongsimMockPaymentWebhookBodyV1 } from "@/lib/bongsim/contracts/payment-webhook.v1";
import { isMockPaymentCaptureAllowed } from "@/lib/bongsim/runtime/mock-payment-allowance";

export type MockCaptureResult =
  | { ok: true; order_id: string }
  | { ok: false; error: "disabled" | "not_found" | "db_error" | "webhook_rejected" };

export async function submitMockCapturePayment(paymentAttemptId: string): Promise<MockCaptureResult> {
  if (!isMockPaymentCaptureAllowed()) {
    return { ok: false, error: "disabled" };
  }

  const pool = getPgPool();
  if (!pool) return { ok: false, error: "db_error" };

  const id = paymentAttemptId.trim();
  if (!id) return { ok: false, error: "not_found" };

  try {
    const r = await pool.query<{ order_id: string }>(
      `SELECT pa.order_id
       FROM bongsim_payment_attempt pa
       JOIN bongsim_order o ON o.order_id = pa.order_id
       WHERE pa.payment_attempt_id = $1 AND o.status = 'awaiting_payment'
       LIMIT 1`,
      [id],
    );
    const orderId = r.rows[0]?.order_id;
    if (!orderId) return { ok: false, error: "not_found" };

    const o = await pool.query<{ grand_total_krw: string }>(
      `SELECT grand_total_krw FROM bongsim_order WHERE order_id = $1`,
      [orderId],
    );
    const grand = Number.parseInt(String(o.rows[0]?.grand_total_krw ?? "0"), 10);

    const event: BongsimMockPaymentWebhookBodyV1 = {
      schema: "bongsim.payment_webhook.mock.v1",
      provider_event_id: randomUUID(),
      payment_attempt_id: id,
      outcome: "captured",
      amount_krw: grand,
      payment_reference: `mock_capture_${Date.now()}`,
    };

    const wh = await processMockPaymentWebhook(event);
    if (!wh.ok) {
      if (wh.reason === "unknown_attempt") return { ok: false, error: "not_found" };
      return { ok: false, error: "webhook_rejected" };
    }

    await processNextOrderPaidOutbox().catch(() => undefined);

    return { ok: true, order_id: orderId };
  } catch {
    return { ok: false, error: "db_error" };
  }
}
