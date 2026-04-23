import { getPgPool } from "@/lib/bongsim/db/pool";
import { advanceFulfillmentForPaidOrder } from "@/lib/bongsim/fulfillment/process-fulfillment-job";

type OutboxRow = {
  id: string;
  topic: string;
  payload: unknown;
  dedupe_key: string;
};

export type ProcessOrderPaidOutboxResult =
  | { outcome: "processed"; outbox_id: string; order_id: string }
  | { outcome: "empty" }
  | { outcome: "skipped_not_paid"; outbox_id: string; order_id: string }
  | { outcome: "error" };

function parseOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const id = o.order_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * Locks one pending `OrderPaid` outbox row, runs mock fulfillment advancement, marks processed after commit.
 */
export async function processNextOrderPaidOutbox(): Promise<ProcessOrderPaidOutboxResult> {
  const pool = getPgPool();
  if (!pool) return { outcome: "error" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pick = await client.query<OutboxRow>(
      `SELECT id, topic, payload, dedupe_key
       FROM bongsim_outbox
       WHERE topic = 'OrderPaid' AND processed_at IS NULL AND available_at <= now()
       ORDER BY available_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );

    const row = pick.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return { outcome: "empty" };
    }

    const orderId = parseOrderId(row.payload);
    if (!orderId) {
      await client.query(
        `UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1`,
        [row.id],
      );
      await client.query("COMMIT");
      return { outcome: "error" };
    }

    const ord = await client.query<{ status: string }>(
      `SELECT status FROM bongsim_order WHERE order_id = $1 FOR UPDATE`,
      [orderId],
    );
    const st = ord.rows[0]?.status;
    if (st !== "paid") {
      await client.query("ROLLBACK");
      return { outcome: "skipped_not_paid", outbox_id: row.id, order_id: orderId };
    }

    await advanceFulfillmentForPaidOrder(client, orderId);

    await client.query(`UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1`, [row.id]);

    await client.query("COMMIT");
    return { outcome: "processed", outbox_id: row.id, order_id: orderId };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { outcome: "error" };
  } finally {
    client.release();
  }
}
