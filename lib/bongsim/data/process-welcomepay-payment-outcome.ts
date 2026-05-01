import type { PoolClient } from "pg";
import type { PaymentAttemptStatus } from "@/lib/bongsim/contracts/public-enums";
import { getPgPool } from "@/lib/bongsim/db/pool";

/**
 * 웰컴페이먼츠(표준결제) 승인 완료 후 DB 반영.
 * `processTossPaymentOutcome` 과 동일한 불변식·멱등( provider_event_id ) 패턴.
 */

export const WELCOMEPAY_PROVIDER_ID = "welcomepay";

export type WelcomepayOutcome = "authorized" | "captured" | "failed" | "cancelled";

export type ProcessWelcomepayPaymentResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "unknown_attempt" | "amount_mismatch" | "not_payable" };

export type ProcessWelcomepayPaymentInput = {
  providerEventId: string;
  paymentAttemptId: string;
  outcome: WelcomepayOutcome;
  amountKrw?: number;
  paymentReference?: string;
  rawPayload: unknown;
};

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
}

function isTerminalAttempt(s: string): boolean {
  return s === "failed" || s === "cancelled" || s === "expired";
}

function rankForward(s: PaymentAttemptStatus): number {
  switch (s) {
    case "created":
      return 10;
    case "redirected":
      return 20;
    case "authorized":
      return 30;
    case "captured":
      return 40;
    default:
      return -1;
  }
}

function maxAttemptStatus(a: PaymentAttemptStatus, b: PaymentAttemptStatus): PaymentAttemptStatus {
  return rankForward(a) >= rankForward(b) ? a : b;
}

async function insertProviderEventIfNew(
  client: PoolClient,
  provider_event_id: string,
  payment_attempt_id: string,
  order_id: string,
  payload: unknown,
): Promise<{ inserted: boolean }> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO bongsim_payment_provider_event (provider, provider_event_id, payment_attempt_id, order_id, payload_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (provider, provider_event_id) DO NOTHING
     RETURNING id`,
    [WELCOMEPAY_PROVIDER_ID, provider_event_id, payment_attempt_id, order_id, JSON.stringify(payload)],
  );
  return { inserted: Boolean(r.rows[0]) };
}

type AttemptRow = {
  payment_attempt_id: string;
  order_id: string;
  status: string;
  amount_krw: string;
  provider: string;
};

type OrderRow = {
  order_id: string;
  status: string;
  grand_total_krw: string;
};

export async function processWelcomepayPaymentOutcome(
  input: ProcessWelcomepayPaymentInput,
): Promise<ProcessWelcomepayPaymentResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const a = await client.query<AttemptRow>(
      `SELECT payment_attempt_id, order_id, status, amount_krw, provider
       FROM bongsim_payment_attempt
       WHERE payment_attempt_id = $1
       FOR UPDATE`,
      [input.paymentAttemptId],
    );
    const attempt = a.rows[0];
    if (!attempt || attempt.provider !== WELCOMEPAY_PROVIDER_ID) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_attempt" };
    }

    const o = await client.query<OrderRow>(
      `SELECT order_id, status, grand_total_krw FROM bongsim_order WHERE order_id = $1 FOR UPDATE`,
      [attempt.order_id],
    );
    const order = o.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_attempt" };
    }

    const { inserted } = await insertProviderEventIfNew(
      client,
      input.providerEventId,
      attempt.payment_attempt_id,
      attempt.order_id,
      input.rawPayload,
    );
    if (!inserted) {
      await client.query("COMMIT");
      return { ok: true, duplicate: true };
    }

    const cur = attempt.status as PaymentAttemptStatus;
    const grand = toInt(order.grand_total_krw);
    const attemptAmount = toInt(attempt.amount_krw);

    const setLastError = async (code: string, message: string) => {
      await client.query(
        `UPDATE bongsim_payment_attempt
         SET last_error = $2::jsonb, updated_at = now()
         WHERE payment_attempt_id = $1`,
        [attempt.payment_attempt_id, JSON.stringify({ code, message })],
      );
    };

    const updateAttemptStatus = async (next: PaymentAttemptStatus) => {
      await client.query(
        `UPDATE bongsim_payment_attempt SET status = $2, updated_at = now(), last_error = NULL
         WHERE payment_attempt_id = $1`,
        [attempt.payment_attempt_id, next],
      );
    };

    if (input.outcome === "authorized") {
      if (isTerminalAttempt(cur)) {
        await setLastError("monotonic_violation", "authorized_after_terminal");
      } else if (cur === "captured") {
        /* no-op */
      } else {
        const next = maxAttemptStatus(cur, "authorized");
        if (next !== cur) await updateAttemptStatus(next);
      }
      await client.query("COMMIT");
      return { ok: true, duplicate: false };
    }

    if (input.outcome === "failed") {
      if (cur === "captured") {
        await setLastError("monotonic_violation", "failed_after_captured");
      } else {
        await updateAttemptStatus("failed");
      }
      await client.query("COMMIT");
      return { ok: true, duplicate: false };
    }

    if (input.outcome === "cancelled") {
      if (cur === "captured") {
        await setLastError("post_capture_cancel", "requires_refund_handling");
      } else {
        await updateAttemptStatus("cancelled");
      }
      await client.query("COMMIT");
      return { ok: true, duplicate: false };
    }

    if (input.amountKrw == null) {
      await setLastError("amount_missing", "captured_without_amount");
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }
    if (attemptAmount !== grand) {
      await setLastError("amount_mismatch", "attempt_amount_neq_order_total");
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }
    if (toInt(input.amountKrw) !== grand) {
      await setLastError("amount_mismatch", "welcomepay_amount_neq_order_total");
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }

    if (isTerminalAttempt(cur)) {
      await setLastError("monotonic_violation", "capture_after_terminal");
      await client.query("COMMIT");
      return { ok: false, reason: "not_payable" };
    }

    if (order.status === "paid") {
      if (cur !== "captured") await updateAttemptStatus("captured");
      await client.query("COMMIT");
      return { ok: true, duplicate: false };
    }

    if (order.status !== "awaiting_payment") {
      await setLastError("order_not_payable", `order_status_${order.status}`);
      await client.query("COMMIT");
      return { ok: false, reason: "not_payable" };
    }

    await updateAttemptStatus("captured");
    const ref = input.paymentReference ?? `welcomepay_${input.providerEventId}`;
    await client.query(
      `UPDATE bongsim_order
       SET status = 'paid',
           paid_at = now(),
           payment_reference = $2,
           paid_amount_krw = $3,
           payment_provider = $4,
           updated_at = now()
       WHERE order_id = $1`,
      [order.order_id, ref, grand, WELCOMEPAY_PROVIDER_ID],
    );

    const dedupeKey = `bongsim:order_paid:${order.order_id}`;
    await client.query(
      `INSERT INTO bongsim_outbox (topic, payload, dedupe_key)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        "OrderPaid",
        JSON.stringify({ order_id: order.order_id, payment_attempt_id: attempt.payment_attempt_id }),
        dedupeKey,
      ],
    );

    await client.query("COMMIT");
    return { ok: true, duplicate: false };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}
