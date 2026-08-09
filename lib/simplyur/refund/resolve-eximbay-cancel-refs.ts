import type { PoolClient } from "pg";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { parseEximbayStatusQuery } from "@/lib/simplyur/payments/eximbay-verify";
import { krwOrderTotalToEximbayUsdAmountResolved } from "@/lib/simplyur/payments/eximbay-ready";

// REGRESSION-FREEZE[simplyur-eximbay-refund]: resolve transaction_id + USD for cancel — manifest

export type EximbayCancelRefs = {
  transactionId: string;
  eximbayOrderId: string;
  amountUsd: string;
};

function pickTransactionIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.transaction_id === "string" && p.transaction_id.trim()) {
    return p.transaction_id.trim();
  }
  if (typeof p.transid === "string" && p.transid.trim()) return p.transid.trim();
  if (typeof p.data === "string" && p.data.includes("=")) {
    const parsed = parseEximbayStatusQuery(p.data);
    if (parsed.transactionId) return parsed.transactionId;
  }
  return null;
}

/**
 * Eximbay cancel needs transaction_id (not merchant order_id).
 * Prefer provider_event_id when it is the capture transaction id; else parse status payload.
 */
export async function resolveEximbayCancelRefs(
  client: PoolClient,
  orderId: string,
): Promise<EximbayCancelRefs | null> {
  const o = await client.query<{
    order_number: string;
    payment_reference: string | null;
    provider_session_id: string | null;
    grand_total_krw: string;
  }>(
    `SELECT o.order_number,
            o.payment_reference,
            o.grand_total_krw::text AS grand_total_krw,
            (
              SELECT a.provider_session_id
                FROM bongsim_payment_attempt a
               WHERE a.order_id = o.order_id
                 AND a.provider = $2
                 AND a.status = 'captured'
               ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
               LIMIT 1
            ) AS provider_session_id
       FROM bongsim_order o
      WHERE o.order_id = $1::uuid
      LIMIT 1`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID],
  );
  const row = o.rows[0];
  if (!row) return null;

  const eximbayOrderId = (
    row.provider_session_id ||
    row.payment_reference ||
    row.order_number ||
    ""
  ).trim();
  if (!eximbayOrderId) return null;

  const events = await client.query<{
    provider_event_id: string;
    payload_json: unknown;
  }>(
    `SELECT provider_event_id, payload_json
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid AND provider = $2
      ORDER BY processed_at DESC NULLS LAST
      LIMIT 20`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID],
  );

  let transactionId: string | null = null;
  for (const ev of events.rows) {
    const fromPayload = pickTransactionIdFromPayload(ev.payload_json);
    if (fromPayload) {
      transactionId = fromPayload;
      break;
    }
    const eid = (ev.provider_event_id ?? "").trim();
    if (eid && !eid.startsWith("eximbay_status_") && !eid.startsWith("eximbay_refund")) {
      transactionId = eid;
      break;
    }
  }

  if (!transactionId) return null;

  const krw = Number.parseInt(row.grand_total_krw, 10);
  if (!Number.isFinite(krw) || krw <= 0) return null;
  const amountUsd = await krwOrderTotalToEximbayUsdAmountResolved(krw);

  return { transactionId, eximbayOrderId, amountUsd };
}
