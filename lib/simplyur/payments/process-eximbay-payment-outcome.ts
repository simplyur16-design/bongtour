import type { PoolClient } from "pg";
import type { PaymentAttemptStatus } from "@/lib/bongsim/contracts/public-enums";
import { recordBongsimCouponUsageAfterCapture } from "@/lib/bongsim/data/bongsim-coupon";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { runBongsimOrderPaidSideEffects } from "@/lib/bongsim/data/bongsim-order-paid-side-effects";
import { drainOrderPaidOutboxBestEffort } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-payments";

// REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: Eximbay status_url → OrderPaid — manifest

export type ProcessEximbayPaymentResult =
  | { ok: true; duplicate: boolean; order_id?: string; order_number?: string }
  | {
      ok: false;
      reason: "db_unconfigured" | "db_error" | "unknown_attempt" | "amount_mismatch" | "not_payable";
    };

export type ProcessEximbayPaymentInput = {
  /** Eximbay payment.order_id (= our order_number) */
  eximbayOrderId: string;
  providerEventId: string;
  rawPayload: unknown;
  /** Optional USD major amount from status query — used only for logging; capture uses order KRW. */
  amountUsd?: string;
};

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
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
    [SIMPLYUR_EXIMBAY_PROVIDER_ID, provider_event_id, payment_attempt_id, order_id, JSON.stringify(payload)],
  );
  return { inserted: Boolean(r.rows[0]) };
}

type AttemptRow = {
  payment_attempt_id: string;
  order_id: string;
  status: string;
  amount_krw: string;
  provider: string;
  provider_session_id: string | null;
  order_number: string;
  order_status: string;
  grand_total_krw: string;
};

export async function processEximbayPaymentOutcome(
  input: ProcessEximbayPaymentInput,
): Promise<ProcessEximbayPaymentResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const orderKey = input.eximbayOrderId.trim();
  if (!orderKey) return { ok: false, reason: "unknown_attempt" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query<{ payment_attempt_id: string }>(
      `SELECT a.payment_attempt_id
       FROM bongsim_payment_attempt a
       JOIN bongsim_order o ON o.order_id = a.order_id
       WHERE a.provider = $1
         AND (a.provider_session_id = $2 OR o.order_number = $2)
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [SIMPLYUR_EXIMBAY_PROVIDER_ID, orderKey],
    );
    const attemptId = found.rows[0]?.payment_attempt_id;
    if (!attemptId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_attempt" };
    }

    const a = await client.query<AttemptRow>(
      `SELECT a.payment_attempt_id, a.order_id, a.status, a.amount_krw, a.provider, a.provider_session_id,
              o.order_number, o.status AS order_status, o.grand_total_krw
       FROM bongsim_payment_attempt a
       JOIN bongsim_order o ON o.order_id = a.order_id
       WHERE a.payment_attempt_id = $1
       FOR UPDATE OF a`,
      [attemptId],
    );
    const attempt = a.rows[0];
    if (!attempt) {
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
      return {
        ok: true,
        duplicate: true,
        order_id: attempt.order_id,
        order_number: attempt.order_number,
      };
    }

    const cur = attempt.status as PaymentAttemptStatus;
    const grand = toInt(attempt.grand_total_krw);
    const attemptAmount = toInt(attempt.amount_krw);

    if (attemptAmount !== grand) {
      await client.query(
        `UPDATE bongsim_payment_attempt
         SET last_error = $2::jsonb, updated_at = now()
         WHERE payment_attempt_id = $1`,
        [attempt.payment_attempt_id, JSON.stringify({ code: "amount_mismatch", message: "attempt_neq_order" })],
      );
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }

    if (attempt.order_status === "paid") {
      if (cur !== "captured") {
        await client.query(
          `UPDATE bongsim_payment_attempt SET status = 'captured', updated_at = now(), last_error = NULL
           WHERE payment_attempt_id = $1`,
          [attempt.payment_attempt_id],
        );
      }
      await client.query("COMMIT");
      return {
        ok: true,
        duplicate: false,
        order_id: attempt.order_id,
        order_number: attempt.order_number,
      };
    }

    if (attempt.order_status !== "awaiting_payment") {
      await client.query("COMMIT");
      return { ok: false, reason: "not_payable" };
    }

    await client.query(
      `UPDATE bongsim_payment_attempt SET status = 'captured', updated_at = now(), last_error = NULL
       WHERE payment_attempt_id = $1`,
      [attempt.payment_attempt_id],
    );

    const ref = attempt.provider_session_id ?? `eximbay_${input.providerEventId}`;
    await client.query(
      `UPDATE bongsim_order
       SET status = 'paid',
           paid_at = now(),
           payment_reference = $2,
           paid_amount_krw = $3,
           payment_provider = $4,
           updated_at = now()
       WHERE order_id = $1`,
      [attempt.order_id, ref, grand, SIMPLYUR_EXIMBAY_PROVIDER_ID],
    );

    const dedupeKey = `bongsim:order_paid:${attempt.order_id}`;
    try {
      await client.query(
        `INSERT INTO bongsim_outbox (topic, payload, dedupe_key)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          "OrderPaid",
          JSON.stringify({
            order_id: attempt.order_id,
            payment_attempt_id: attempt.payment_attempt_id,
          }),
          dedupeKey,
        ],
      );
    } catch (e) {
      const er = e as { code?: string };
      if (er.code !== "42P01" && er.code !== "42703") throw e;
    }

    try {
      await recordBongsimCouponUsageAfterCapture(client, attempt.order_id);
    } catch {
      /* simplyur has no coupons */
    }

    await client.query("COMMIT");

    try {
      await runBongsimOrderPaidSideEffects(attempt.order_id);
    } catch (err) {
      console.warn("[simplyur:eximbay:paid-side-effects]", err);
    }

    try {
      await drainOrderPaidOutboxBestEffort();
    } catch (err) {
      console.warn("[simplyur:eximbay:outbox-drain]", err);
    }

    return {
      ok: true,
      duplicate: false,
      order_id: attempt.order_id,
      order_number: attempt.order_number,
    };
  } catch (e) {
    console.error("[simplyur:eximbay:process]", e);
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
