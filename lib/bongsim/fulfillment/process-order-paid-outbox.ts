import {
  classifyBongsimPgError,
  getPgPool,
  healBongsimPgPoolForCatalog,
} from "@/lib/bongsim/db/pool";
import { advanceFulfillmentForPaidOrderReleasingDuringSubmit } from "@/lib/bongsim/fulfillment/process-fulfillment-job";
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
  }
}

/**
 * REGRESSION-FREEZE[bongsim-fulfill-release-during-usimsa]: claim → release → USIMSA HTTP → persist
 * (트랜잭션 안 HTTP로 pool max=2~5 고갈 → 무상발급 500 방지)
 */
export async function processNextOrderPaidOutbox(): Promise<ProcessOrderPaidOutboxResult> {
  const pool = getPgPool();
  if (!pool) {
    console.error("[bongsim:outbox:process] db_unconfigured (no pool)");
    return { outcome: "error" };
  }

  let picked: OutboxRow | null = null;
  let orderId: string | null = null;

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

    // HTTP는 커넥션 반환 후 수행 — 여기서는 claim만 확정
    await client.query(
      `UPDATE bongsim_outbox
          SET locked_at = now(),
              available_at = now() + interval '2 minutes'
        WHERE id = $1`,
      [row.id],
    );
    await client.query("COMMIT");
  } catch (err) {
    logOutboxProcessError(err, { outbox_id: picked?.id, order_id: orderId ?? undefined });
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (picked) {
      try {
        await deferOrTerminalOutboxAfterFailure(client, {
          outbox_id: picked.id,
          payload: picked.payload,
          reason: "fulfillment_error",
          order_status: null,
          err,
        });
      } catch {
        /* ignore */
      }
    }
    return { outcome: "error", outbox_id: picked?.id, order_id: orderId ?? undefined };
  } finally {
    client.release();
  }

  if (!picked || !orderId) return { outcome: "error" };

  try {
    await advanceFulfillmentForPaidOrderReleasingDuringSubmit(orderId);

    const c2 = await pool.connect();
    try {
      await c2.query(
        `UPDATE bongsim_outbox
            SET processed_at = now(), locked_at = now(), available_at = now()
          WHERE id = $1 AND processed_at IS NULL`,
        [picked.id],
      );
    } finally {
      c2.release();
    }
    return { outcome: "processed", outbox_id: picked.id, order_id: orderId };
  } catch (err) {
    logOutboxProcessError(err, { outbox_id: picked.id, order_id: orderId });
    try {
      await healBongsimPgPoolForCatalog(
        err instanceof Error ? err.message : "order-paid-fulfill",
      );
    } catch {
      /* ignore */
    }
    const c3 = await getPgPool()?.connect();
    if (c3) {
      try {
        await deferOrTerminalOutboxAfterFailure(c3, {
          outbox_id: picked.id,
          payload: picked.payload,
          reason: "fulfillment_error",
          order_status: null,
          err,
        });
      } catch {
        /* ignore */
      } finally {
        c3.release();
      }
    }
    if (classifyBongsimPgError(err) === "connection_timeout") {
      return { outcome: "error", outbox_id: picked.id, order_id: orderId };
    }
    return { outcome: "error", outbox_id: picked.id, order_id: orderId };
  }
}
