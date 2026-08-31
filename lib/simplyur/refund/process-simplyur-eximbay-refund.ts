import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { terminalPendingEsimQrNotifyForOrder } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";
import {
  cancelUsimsaTopup,
  cancelUsimsaUsimTopup,
  UsimsaCancelError,
} from "@/lib/bongsim/supplier/usimsa/order-api";
import { checkUsimsaOrderDataUsageForRefund } from "@/lib/bongsim/refund/usimsa-refund-usage";
import { notifyRefundCompletedBestEffort } from "@/lib/bongsim/refund/notify-refund-completed";
import type { RefundRequestedBy } from "@/lib/bongsim/refund/process-refund";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { resolveEximbayEnv } from "@/lib/simplyur/payments/eximbay-env";
import {
  buildEximbayCancelBody,
  callEximbayPaymentsCancel,
} from "@/lib/simplyur/payments/eximbay-cancel";
import { resolveEximbayCancelRefs } from "@/lib/simplyur/refund/resolve-eximbay-cancel-refs";

// REGRESSION-FREEZE[simplyur-eximbay-refund]: unused → Eximbay card cancel THEN USIMSA cancel — manifest

export type ProcessSimplyurEximbayRefundResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "order_not_found"
        | "invalid_status"
        | "unsupported_provider"
        | "not_simplyur_order"
        | "missing_payment_reference"
        | "eximbay_env_incomplete"
        | "esim_used_no_refund"
        | "usage_check_failed"
        | "supplier_refund_failed"
        | "pg_cancel_failed"
        | "already_refunded"
        | "db_error";
      message?: string;
    };

type LockedOrder = {
  order_id: string;
  status: string;
  grand_total_krw: string;
  payment_provider: string | null;
  checkout_channel: string | null;
};

const REFUND_EVENT = {
  cardCancelRequested: "refund_card_cancel_requested",
  supplierApplied: "refund_supplier_applied",
  cardCancelApproved: "outbound_refund",
} as const;

async function insertRefundEvent(
  client: PoolClient,
  providerEventId: string,
  paymentAttemptId: string | null,
  orderId: string,
  payload: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO bongsim_payment_provider_event (provider, provider_event_id, payment_attempt_id, order_id, payload_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (provider, provider_event_id) DO NOTHING`,
    [SIMPLYUR_EXIMBAY_PROVIDER_ID, providerEventId, paymentAttemptId, orderId, JSON.stringify(payload)],
  );
}

async function hasRefundEvent(client: PoolClient, orderId: string, direction: string): Promise<boolean> {
  const r = await client.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_payment_provider_event
        WHERE order_id = $1::uuid
          AND provider = $2
          AND payload_json->>'direction' = $3
     ) AS ok`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID, direction],
  );
  return Boolean(r.rows[0]?.ok);
}

/** Card cancel actually approved — resume must not call Eximbay twice. */
async function hasSuccessfulCardCancel(client: PoolClient, orderId: string): Promise<boolean> {
  const r = await client.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_payment_provider_event
        WHERE order_id = $1::uuid
          AND provider = $2
          AND payload_json->>'direction' = $3
          AND payload_json->>'ok' = 'true'
     ) AS ok`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID, REFUND_EVENT.cardCancelApproved],
  );
  return Boolean(r.rows[0]?.ok);
}

async function getPreviousOrderStatus(
  client: PoolClient,
  orderId: string,
): Promise<"paid" | "delivered" | null> {
  const r = await client.query<{ previous: string | null }>(
    `SELECT payload_json->>'previous_order_status' AS previous
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid
        AND provider = $2
        AND payload_json->>'direction' = $3
      ORDER BY processed_at DESC NULLS LAST
      LIMIT 1`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID, REFUND_EVENT.cardCancelRequested],
  );
  const prev = (r.rows[0]?.previous ?? "").trim();
  if (prev === "paid" || prev === "delivered") return prev;
  return null;
}

async function getCapturedAttemptId(client: PoolClient, orderId: string): Promise<string | null> {
  const att = await client.query<{ payment_attempt_id: string | null }>(
    `SELECT payment_attempt_id::text AS payment_attempt_id
       FROM bongsim_payment_attempt
      WHERE order_id = $1::uuid AND provider = $2 AND status = 'captured'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [orderId, SIMPLYUR_EXIMBAY_PROVIDER_ID],
  );
  return att.rows[0]?.payment_attempt_id ?? null;
}

type SupplierCancelRow = { topup_id: string; fulfillment_mode: string };

async function listTopups(client: PoolClient, orderId: string): Promise<SupplierCancelRow[]> {
  const rows = await client.query<SupplierCancelRow>(
    `SELECT t.topup_id,
            COALESCE(
              NULLIF(t.webhook_payload->>'fulfillment_kind', ''),
              l.snapshot->>'fulfillment_mode',
              'esim'
            ) AS fulfillment_mode
       FROM bongsim_fulfillment_topup t
       LEFT JOIN bongsim_order_line l
         ON l.order_id = t.order_id AND l.option_api_id = t.option_api_id
      WHERE t.order_id = $1::uuid AND t.supplier_id = 'usimsa'
        AND t.status NOT IN ('canceled', 'failed')`,
    [orderId],
  );
  return rows.rows;
}

/**
 * Simplyur Eximbay full refund — operator order:
 * 1) refund_requested  2) Eximbay card cancel  3) USIMSA cancel → refunded
 * Resume: if card already ok, skip Eximbay and finish USIMSA only.
 */
export async function processSimplyurEximbayRefund(
  orderId: string,
  reason: string,
  requestedBy: RefundRequestedBy,
): Promise<ProcessSimplyurEximbayRefundResult> {
  const id = orderId.trim();
  const msg = reason.trim() || "Customer unused eSIM cancel";
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const env = resolveEximbayEnv();
  if (!env.ok) return { ok: false, reason: "eximbay_env_incomplete", message: env.missing.join(",") };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const o1 = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, checkout_channel
         FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    let order = o1.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found" };
    }

    if (!(order.checkout_channel ?? "").startsWith("simplyur_")) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_simplyur_order" };
    }

    if (order.status === "refunded") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already_refunded" };
    }

    const allowedStart = order.status === "paid" || order.status === "delivered";
    const resuming = order.status === "refund_requested";
    if (!allowedStart && !resuming) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status", message: order.status };
    }

    if ((order.payment_provider ?? "").trim() !== SIMPLYUR_EXIMBAY_PROVIDER_ID) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unsupported_provider", message: order.payment_provider ?? "" };
    }

    const refs = await resolveEximbayCancelRefs(client, id);
    if (!refs) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "missing_payment_reference" };
    }

    if (!resuming) {
      const usage = await checkUsimsaOrderDataUsageForRefund(id, client);
      if (!usage.ok) {
        await client.query("ROLLBACK");
        if (usage.reason === "esim_used") {
          return { ok: false, reason: "esim_used_no_refund", message: usage.message };
        }
        return { ok: false, reason: "usage_check_failed", message: usage.message };
      }

      const previousStatus = order.status as "paid" | "delivered";
      const paymentAttemptId = await getCapturedAttemptId(client, id);
      await insertRefundEvent(
        client,
        `eximbay_refund_request_${id}_${Date.now()}_${randomBytes(4).toString("hex")}`,
        paymentAttemptId,
        id,
        {
          direction: REFUND_EVENT.cardCancelRequested,
          phase: 1,
          previous_order_status: previousStatus,
          requested_by: requestedBy,
          reason: msg,
        },
      );
      await client.query(
        `UPDATE bongsim_order SET status = 'refund_requested', updated_at = now() WHERE order_id = $1::uuid`,
        [id],
      );
    }

    await client.query("COMMIT");

    // Phase 2 — Eximbay card cancel FIRST (then USIMSA).
    if (!(await hasSuccessfulCardCancel(client, id))) {
      const refs2 = await resolveEximbayCancelRefs(client, id);
      if (!refs2) return { ok: false, reason: "missing_payment_reference" };

      const refundId = `rf_${id.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`.slice(0, 30);
      const cancelBody = buildEximbayCancelBody({
        mid: env.env.mid,
        transactionOrderId: refs2.eximbayOrderId,
        amountUsd: refs2.amountUsd,
        refundId,
        reason: msg,
      });
      const pg = await callEximbayPaymentsCancel(refs2.transactionId, cancelBody);

      await client.query("BEGIN");
      const oPg = await client.query<LockedOrder>(
        `SELECT order_id::text, status, grand_total_krw::text, payment_provider, checkout_channel
           FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
        [id],
      );
      order = oPg.rows[0];
      if (!order || order.status !== "refund_requested") {
        await client.query("ROLLBACK");
        return { ok: false, reason: "invalid_status", message: order?.status ?? "missing" };
      }
      const paymentAttemptId = await getCapturedAttemptId(client, id);
      await insertRefundEvent(
        client,
        `eximbay_refund_${refs2.transactionId}_${refundId}_${randomBytes(4).toString("hex")}`.slice(0, 120),
        paymentAttemptId,
        id,
        {
          direction: REFUND_EVENT.cardCancelApproved,
          phase: 2,
          requested_by: requestedBy,
          reason: msg,
          request: cancelBody,
          transaction_id: refs2.transactionId,
          ok: pg.ok,
          rescode: pg.ok ? pg.rescode : pg.rescode,
          resmsg: pg.ok ? pg.resmsg : pg.resmsg,
          refund_transaction_id: pg.ok ? pg.refundTransactionId : null,
        },
      );
      if (!pg.ok) {
        const previousStatus = await getPreviousOrderStatus(client, id);
        if (previousStatus) {
          await client.query(
            `UPDATE bongsim_order SET status = $2, updated_at = now() WHERE order_id = $1::uuid`,
            [id, previousStatus],
          );
        }
        await client.query("COMMIT");
        return {
          ok: false,
          reason: "pg_cancel_failed",
          message: pg.resmsg || pg.detail || pg.reason,
        };
      }
      await client.query("COMMIT");
    }

    // Phase 3 — USIMSA after card cancel succeeded. Do not revert to paid if this fails.
    let supplierResults: Array<{ topup_id: string; code: string; message: string }> | null = null;
    if (!(await hasRefundEvent(client, id, REFUND_EVENT.supplierApplied))) {
      const topups = await listTopups(client, id);
      const results: Array<{ topup_id: string; code: string; message: string }> = [];
      try {
        for (const row of topups) {
          const res =
            row.fulfillment_mode === "usim"
              ? await cancelUsimsaUsimTopup(row.topup_id)
              : await cancelUsimsaTopup(row.topup_id);
          results.push({
            topup_id: row.topup_id,
            code: String(res?.code ?? ""),
            message: String(res?.message ?? ""),
          });
        }
        supplierResults = results;
      } catch (e) {
        const detail =
          e instanceof UsimsaCancelError
            ? `Supplier cancel rejected (${e.code})`
            : e instanceof Error
              ? e.message
              : String(e);
        return { ok: false, reason: "supplier_refund_failed", message: detail };
      }
    }

    await client.query("BEGIN");
    const o2 = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, checkout_channel
         FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    order = o2.rows[0];
    if (!order || order.status !== "refund_requested") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status", message: order?.status ?? "missing" };
    }

    if (supplierResults && !(await hasRefundEvent(client, id, REFUND_EVENT.supplierApplied))) {
      for (const row of supplierResults) {
        await client.query(
          `UPDATE bongsim_fulfillment_topup
              SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
            WHERE topup_id = $1`,
          [row.topup_id],
        );
      }
      const paymentAttemptId = await getCapturedAttemptId(client, id);
      await insertRefundEvent(
        client,
        `eximbay_refund_supplier_${id}_${Date.now()}_${randomBytes(4).toString("hex")}`,
        paymentAttemptId,
        id,
        {
          direction: REFUND_EVENT.supplierApplied,
          phase: 3,
          requested_by: requestedBy,
          reason: msg,
          topups: supplierResults,
        },
      );
    }

    const paymentAttemptId = await getCapturedAttemptId(client, id);
    await client.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
      id,
    ]);
    await terminalPendingEsimQrNotifyForOrder(client, id, "refunded");
    if (paymentAttemptId) {
      await client.query(
        `UPDATE bongsim_payment_attempt SET status = 'cancelled', updated_at = now() WHERE payment_attempt_id = $1::uuid`,
        [paymentAttemptId],
      );
    }
    await client.query("COMMIT");

    await notifyRefundCompletedBestEffort(id);
    return { ok: true };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[processSimplyurEximbayRefund]", e);
    return { ok: false, reason: "db_error", message: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}
