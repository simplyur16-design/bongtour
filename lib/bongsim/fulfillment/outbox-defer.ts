import type { PoolClient } from "pg";

const MAX_OUTBOX_ATTEMPTS = 5;
const TERMINAL_ORDER_STATUSES = new Set(["refunded", "cancelled", "failed"]);

type DeferMeta = {
  attempts?: number;
  reason?: string;
  order_status?: string | null;
  last_error?: string;
  terminal?: boolean;
};

function readDeferMeta(payload: unknown): DeferMeta {
  if (!payload || typeof payload !== "object") return {};
  const o = payload as Record<string, unknown>;
  const d = o._outbox_defer;
  if (!d || typeof d !== "object") return {};
  return d as DeferMeta;
}

function mergeDeferPayload(payload: unknown, patch: DeferMeta): string {
  const base =
    payload && typeof payload === "object" ? { ...(payload as Record<string, unknown>) } : {};
  const prev = readDeferMeta(payload);
  return JSON.stringify({
    ...base,
    _outbox_defer: { ...prev, ...patch },
  });
}

/** 트랜잭션 ROLLBACK 이후 같은 커넥션에서 호출 — 실패·skip 행을 큐 뒤로 미루거나 종결 */
export async function deferOrTerminalOutboxAfterFailure(
  client: PoolClient,
  input: {
    outbox_id: string;
    payload: unknown;
    reason: string;
    order_status?: string | null;
    err?: unknown;
  },
): Promise<"deferred" | "terminal"> {
  const prev = readDeferMeta(input.payload);
  const attempts = (prev.attempts ?? 0) + 1;
  const errMsg =
    input.err instanceof Error
      ? input.err.message
      : input.err != null
        ? String(input.err)
        : undefined;

  const terminalByStatus =
    input.reason === "skipped_not_paid" &&
    input.order_status != null &&
    TERMINAL_ORDER_STATUSES.has(input.order_status);

  if (terminalByStatus || attempts >= MAX_OUTBOX_ATTEMPTS) {
    await client.query(
      `UPDATE bongsim_outbox
       SET processed_at = now(),
           locked_at = now(),
           payload = $2::jsonb
       WHERE id = $1`,
      [
        input.outbox_id,
        mergeDeferPayload(input.payload, {
          attempts,
          reason: input.reason,
          order_status: input.order_status ?? null,
          last_error: errMsg,
          terminal: true,
        }),
      ],
    );
    console.error("[bongsim:outbox:terminal]", {
      outbox_id: input.outbox_id,
      reason: input.reason,
      order_status: input.order_status ?? null,
      attempts,
    });
    return "terminal";
  }

  const backoffMinutes = Math.min(60, 5 * attempts);
  await client.query(
    `UPDATE bongsim_outbox
     SET available_at = now() + ($2::int * interval '1 minute'),
         locked_at = now(),
         payload = $3::jsonb
     WHERE id = $1`,
    [
      input.outbox_id,
      backoffMinutes,
      mergeDeferPayload(input.payload, {
        attempts,
        reason: input.reason,
        order_status: input.order_status ?? null,
        last_error: errMsg,
      }),
    ],
  );
  console.error("[bongsim:outbox:deferred]", {
    outbox_id: input.outbox_id,
    reason: input.reason,
    order_status: input.order_status ?? null,
    attempts,
    backoff_minutes: backoffMinutes,
  });
  return "deferred";
}
