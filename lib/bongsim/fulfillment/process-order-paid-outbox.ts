import { getPgPool } from "@/lib/bongsim/db/pool";
import { advanceFulfillmentForPaidOrder } from "@/lib/bongsim/fulfillment/process-fulfillment-job";
import { deferOrTerminalOutboxAfterFailure } from "@/lib/bongsim/fulfillment/outbox-defer";

type OutboxRow = {
  id: string;
  topic: string;
  payload: unknown;
  dedupe_key: string;
};

export type ProcessOrderPaidOutboxResult =
  | { outcome: "processed"; outbox_id: string; order_id: string }
  | { outcome: "empty" }
  | { outcome: "skipped_not_paid"; outbox_id: string; order_id: string; order_status: string | null }
  | { outcome: "error"; outbox_id?: string; order_id?: string };

function parseOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const id = o.order_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function logOutboxProcessError(err: unknown, ctx?: { outbox_id?: string; order_id?: string }): void {
  const prefix = { ...ctx };
  if (err instanceof Error) {
    console.error("[bongsim:outbox:process]", prefix, err.message, err.stack);
    return;
  }
  const er = err as {
    code?: string;
    message?: string;
    detail?: string;
    constraint?: string;
    column?: string;
  };
  console.error("[bongsim:outbox:process]", prefix, {
    message: er.message ?? String(err),
    code: er.code,
    detail: er.detail,
    constraint: er.constraint,
    column: er.column,
  });
}

/**
 * Locks one pending `OrderPaid` outbox row, runs mock fulfillment advancement, marks processed after commit.
 */
/** 결제 확정 직후 best-effort — mock 캡처와 동일하게 outbox를 비운다. */
export async function drainOrderPaidOutboxBestEffort(maxRounds = 8): Promise<void> {
  for (let i = 0; i < maxRounds; i += 1) {
    const r = await processNextOrderPaidOutbox();
    if (r.outcome === "empty") break;
    if (r.outcome === "processed") {
      const { maybeDeliverEsimAfterFulfillment } = await import(
        "@/lib/bongsim/fulfillment/esim-delivery"
      );
      await maybeDeliverEsimAfterFulfillment(r.order_id).catch((e) => {
        console.warn("[bongsim:outbox:deliver]", e);
      });
      continue;
    }
    /* error / skipped_not_paid — 해당 행은 defer·terminal 처리됨, 다음 outbox 계속 */
  }
}

export async function processNextOrderPaidOutbox(): Promise<ProcessOrderPaidOutboxResult> {
  const pool = getPgPool();
  if (!pool) {
    console.error("[bongsim:outbox:process] db_unconfigured (no pool)");
    return { outcome: "error" };
  }

  const client = await pool.connect();
  let picked: OutboxRow | null = null;
  let orderId: string | null = null;

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
    picked = row;

    orderId = parseOrderId(row.payload);
    if (!orderId) {
      console.error("[bongsim:outbox:process] invalid_payload_missing_order_id", {
        outbox_id: row.id,
      });
      await client.query(
        `UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1`,
        [row.id],
      );
      await client.query("COMMIT");
      return { outcome: "error", outbox_id: row.id };
    }

    const ord = await client.query<{ status: string }>(
      `SELECT status FROM bongsim_order WHERE order_id = $1 FOR UPDATE`,
      [orderId],
    );
    const st = ord.rows[0]?.status;
    if (st !== "paid") {
      console.error("[bongsim:outbox:skipped_not_paid]", {
        outbox_id: row.id,
        order_id: orderId,
        order_status: st ?? null,
      });
      await client.query("ROLLBACK");
      await deferOrTerminalOutboxAfterFailure(client, {
        outbox_id: row.id,
        payload: row.payload,
        reason: "skipped_not_paid",
        order_status: st ?? null,
      });
      return {
        outcome: "skipped_not_paid",
        outbox_id: row.id,
        order_id: orderId,
        order_status: st ?? null,
      };
    }

    await advanceFulfillmentForPaidOrder(client, orderId);

    await client.query(`UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1`, [row.id]);

    await client.query("COMMIT");
    return { outcome: "processed", outbox_id: row.id, order_id: orderId };
  } catch (err) {
    logOutboxProcessError(err, { outbox_id: picked?.id, order_id: orderId ?? undefined });
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (picked) {
      await deferOrTerminalOutboxAfterFailure(client, {
        outbox_id: picked.id,
        payload: picked.payload,
        reason: "fulfillment_error",
        order_status: null,
        err,
      });
    }
    return { outcome: "error", outbox_id: picked?.id, order_id: orderId ?? undefined };
  } finally {
    client.release();
  }
}
