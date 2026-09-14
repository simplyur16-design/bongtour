import { getPgPool } from "@/lib/bongsim/db/pool";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { processSimplyurEximbayRefund } from "@/lib/simplyur/refund/process-simplyur-eximbay-refund";

// REGRESSION-FREEZE[simplyur-eximbay-refund-inbound-usimsa]: status_url REFUND → unused USIMSA cancel — manifest

export type ProcessEximbayInboundRefundResult =
  | { ok: true; duplicate?: boolean; order_id: string; order_number: string }
  | {
      ok: false;
      reason: string;
      message?: string;
      order_id?: string;
      order_number?: string;
    };

/**
 * Eximbay already cancelled the card (console or refund status_url).
 * Unused eSIM → cancel USIMSA + mark refunded. Registered/used → leave issued.
 */
export async function processEximbayInboundRefund(input: {
  eximbayOrderId: string;
  transactionId?: string | null;
}): Promise<ProcessEximbayInboundRefundResult> {
  const key = input.eximbayOrderId.trim();
  if (!key) return { ok: false, reason: "unknown_attempt" };

  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const found = await pool.query<{ order_id: string; order_number: string; status: string }>(
    `SELECT o.order_id::text, o.order_number, o.status
       FROM bongsim_order o
       LEFT JOIN bongsim_payment_attempt a ON a.order_id = o.order_id AND a.provider = $2
      WHERE o.order_number = $1 OR a.provider_session_id = $1
      ORDER BY o.created_at DESC
      LIMIT 1`,
    [key, SIMPLYUR_EXIMBAY_PROVIDER_ID],
  );
  const row = found.rows[0];
  if (!row) return { ok: false, reason: "order_not_found" };
  if (row.status === "refunded") {
    return { ok: true, duplicate: true, order_id: row.order_id, order_number: row.order_number };
  }

  const result = await processSimplyurEximbayRefund(
    row.order_id,
    "Eximbay inbound card refund",
    { kind: "admin", id: "eximbay_status_url" },
    { cardAlreadyCancelled: true },
  );
  if (result.ok) {
    return { ok: true, order_id: row.order_id, order_number: row.order_number };
  }
  return {
    ok: false,
    reason: result.reason,
    message: result.message,
    order_id: row.order_id,
    order_number: row.order_number,
  };
}
