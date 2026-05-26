import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import {
  cancelUsimsaTopup,
  UsimsaCancelError,
} from "@/lib/bongsim/supplier/usimsa/order-api";
import {
  buildWelcomepayCancelFormBody,
  requestWelcomepayFullCancel,
  resolveWelcomepaySignKey,
  welcomepayCancelFailMessage,
} from "@/lib/bongsim/welcomepay-payapi-cancel";
import { notifyRefundCompletedBestEffort } from "@/lib/bongsim/refund/notify-refund-completed";
import { resolveWelcomepayCaptureTid } from "@/lib/bongsim/refund/resolve-welcomepay-capture-tid";

export type RefundRequestedBy = { kind: "admin"; id: string } | { kind: "customer" };

export type ProcessRefundResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "order_not_found"
        | "invalid_status"
        | "unsupported_provider"
        | "missing_payment_reference"
        | "welcomepay_env_incomplete"
        | "esim_activated_no_refund"
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
  payment_reference: string | null;
};

const REFUND_EVENT = {
  cardCancelRequested: "refund_card_cancel_requested",
  supplierApplied: "refund_supplier_applied",
  cardCancelApproved: "outbound_refund",
} as const;

async function orderHasUsimsaIccid(client: PoolClient, orderId: string): Promise<boolean> {
  const r = await client.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_fulfillment_topup t
       WHERE t.order_id = $1::uuid
         AND t.supplier_id = 'usimsa'
         AND t.iccid IS NOT NULL
         AND trim(t.iccid) <> ''
     ) AS ok`,
    [orderId],
  );
  return Boolean(r.rows[0]?.ok);
}

async function insertRefundProviderEvent(
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
    [WELCOMEPAY_PROVIDER_ID, providerEventId, paymentAttemptId, orderId, JSON.stringify(payload)],
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
    [orderId, WELCOMEPAY_PROVIDER_ID, direction],
  );
  return Boolean(r.rows[0]?.ok);
}

async function getPreviousOrderStatusFromRefundRequest(
  client: PoolClient,
  orderId: string,
): Promise<"paid" | "delivered" | null> {
  const r = await client.query<{ previous: string | null }>(
    `SELECT payload_json->>'previous_order_status' AS previous
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid
        AND provider = $2
        AND payload_json->>'direction' = $3
      ORDER BY processed_at DESC
      LIMIT 1`,
    [orderId, WELCOMEPAY_PROVIDER_ID, REFUND_EVENT.cardCancelRequested],
  );
  const prev = (r.rows[0]?.previous ?? "").trim();
  if (prev === "paid" || prev === "delivered") return prev;
  return null;
}

async function getCapturedPaymentAttemptId(client: PoolClient, orderId: string): Promise<string | null> {
  const att = await client.query<{ payment_attempt_id: string | null }>(
    `SELECT payment_attempt_id::text AS payment_attempt_id
       FROM bongsim_payment_attempt
      WHERE order_id = $1::uuid AND provider = $2 AND status = 'captured'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [orderId, WELCOMEPAY_PROVIDER_ID],
  );
  return att.rows[0]?.payment_attempt_id ?? null;
}

async function validateRefundOrder(
  client: PoolClient,
  order: LockedOrder,
  orderId: string,
): Promise<ProcessRefundResult | null> {
  if (order.status === "refunded") {
    return { ok: false, reason: "already_refunded" };
  }

  const allowedStart = order.status === "paid" || order.status === "delivered";
  const resuming = order.status === "refund_requested";
  if (!allowedStart && !resuming) {
    return { ok: false, reason: "invalid_status", message: order.status };
  }

  if ((order.payment_provider ?? "").trim() !== WELCOMEPAY_PROVIDER_ID) {
    return { ok: false, reason: "unsupported_provider", message: order.payment_provider ?? "" };
  }

  const tid = await resolveWelcomepayCaptureTid(client, orderId, order.payment_reference);
  if (!tid) {
    return {
      ok: false,
      reason: "missing_payment_reference",
      message: "승인 TID를 찾을 수 없습니다. PG 승인 이벤트 또는 payment_reference를 확인해 주세요.",
    };
  }

  if (await orderHasUsimsaIccid(client, orderId)) {
    return { ok: false, reason: "esim_activated_no_refund" };
  }

  const priceKrw = Number.parseInt(order.grand_total_krw, 10);
  if (!Number.isFinite(priceKrw) || priceKrw <= 0) {
    return { ok: false, reason: "db_error", message: "invalid_grand_total" };
  }

  return null;
}

/** 1단계: 카드 취소 요청 접수 (PG 호출 없음, 주문 상태만 기록) */
async function phase1RecordCardCancelRequest(
  client: PoolClient,
  order: LockedOrder,
  orderId: string,
  msg: string,
  requestedBy: RefundRequestedBy,
): Promise<ProcessRefundResult | { ok: true; previousStatus: "paid" | "delivered" }> {
  if (order.status === "refund_requested") {
    const prev = await getPreviousOrderStatusFromRefundRequest(client, orderId);
    if (!prev) {
      return { ok: false, reason: "db_error", message: "refund_requested but missing previous_order_status event" };
    }
    return { ok: true, previousStatus: prev };
  }

  const previousStatus = order.status as "paid" | "delivered";
  const paymentAttemptId = await getCapturedPaymentAttemptId(client, orderId);
  const providerEventId = `welcomepay_refund_request_${orderId}_${Date.now()}_${randomBytes(4).toString("hex")}`;

  await insertRefundProviderEvent(client, providerEventId, paymentAttemptId, orderId, {
    direction: REFUND_EVENT.cardCancelRequested,
    phase: 1,
    previous_order_status: previousStatus,
    requested_by: requestedBy,
    reason: msg,
  });

  await client.query(
    `UPDATE bongsim_order SET status = 'refund_requested', updated_at = now() WHERE order_id = $1::uuid`,
    [orderId],
  );

  return { ok: true, previousStatus };
}

type SupplierCancelRow = { topup_id: string };

async function listUsimsaTopupsToCancel(client: PoolClient, orderId: string): Promise<string[]> {
  const rows = await client.query<SupplierCancelRow>(
    `SELECT topup_id FROM bongsim_fulfillment_topup
      WHERE order_id = $1::uuid AND supplier_id = 'usimsa'
        AND (iccid IS NULL OR trim(iccid) = '')
        AND status NOT IN ('canceled', 'failed')`,
    [orderId],
  );
  return rows.rows.map((r) => r.topup_id);
}

/** 2단계: 유심사 API 환불(취소) 신청 — API는 트랜잭션 밖에서 호출 */
async function callUsimsaCancelTopups(
  topupIds: string[],
): Promise<
  | { ok: true; results: Array<{ topup_id: string; code: string; message: string }> }
  | { ok: false; message: string }
> {
  const results: Array<{ topup_id: string; code: string; message: string }> = [];
  try {
    for (const topupId of topupIds) {
      const res = await cancelUsimsaTopup(topupId);
      results.push({
        topup_id: topupId,
        code: String(res?.code ?? ""),
        message: String(res?.message ?? ""),
      });
    }
    return { ok: true, results };
  } catch (e) {
    const detail =
      e instanceof UsimsaCancelError
        ? `유심사 취소 거절 (${e.code})`
        : e instanceof Error
          ? e.message
          : String(e);
    return { ok: false, message: detail };
  }
}

async function persistSupplierRefundApplied(
  client: PoolClient,
  orderId: string,
  msg: string,
  requestedBy: RefundRequestedBy,
  results: Array<{ topup_id: string; code: string; message: string }>,
): Promise<void> {
  for (const row of results) {
    await client.query(
      `UPDATE bongsim_fulfillment_topup
          SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
        WHERE topup_id = $1`,
      [row.topup_id],
    );
  }

  const paymentAttemptId = await getCapturedPaymentAttemptId(client, orderId);
  const providerEventId = `welcomepay_refund_supplier_${orderId}_${Date.now()}_${randomBytes(4).toString("hex")}`;

  await insertRefundProviderEvent(client, providerEventId, paymentAttemptId, orderId, {
    direction: REFUND_EVENT.supplierApplied,
    phase: 2,
    requested_by: requestedBy,
    reason: msg,
    topups: results,
  });
}

type PgCancelOutcome = Awaited<ReturnType<typeof requestWelcomepayFullCancel>>;

/** 3단계: PG 호출(트랜잭션 밖) */
async function callWelcomepayCardCancel(
  client: PoolClient,
  order: LockedOrder,
  orderId: string,
  msg: string,
  mid: string,
  signKey: string,
): Promise<
  | { ok: false; reason: "missing_payment_reference" | "db_error"; message?: string }
  | { ok: true; tid: string; priceKrw: number; cancelBody: ReturnType<typeof buildWelcomepayCancelFormBody>; pg: PgCancelOutcome }
> {
  const tid = await resolveWelcomepayCaptureTid(client, orderId, order.payment_reference);
  if (!tid) {
    return { ok: false, reason: "missing_payment_reference", message: "승인 TID를 찾을 수 없습니다." };
  }

  const priceKrw = Number.parseInt(order.grand_total_krw, 10);
  if (!Number.isFinite(priceKrw) || priceKrw <= 0) {
    return { ok: false, reason: "db_error", message: "invalid_grand_total" };
  }

  const cancelBody = buildWelcomepayCancelFormBody({ signKey, mid, tid, priceKrw });
  const pg = await requestWelcomepayFullCancel({ signKey, mid, tid, priceKrw });
  return { ok: true, tid, priceKrw, cancelBody, pg };
}

async function persistCardCancelOutcome(
  client: PoolClient,
  orderId: string,
  msg: string,
  requestedBy: RefundRequestedBy,
  tid: string,
  cancelBody: ReturnType<typeof buildWelcomepayCancelFormBody>,
  pg: PgCancelOutcome,
): Promise<ProcessRefundResult> {
  const paymentAttemptId = await getCapturedPaymentAttemptId(client, orderId);
  const providerEventId = `welcomepay_refund_${tid}_${cancelBody.timestamp}_${randomBytes(4).toString("hex")}`;

  await insertRefundProviderEvent(client, providerEventId, paymentAttemptId, orderId, {
    direction: REFUND_EVENT.cardCancelApproved,
    phase: 3,
    requested_by: requestedBy,
    reason: msg,
    request: cancelBody,
    http_status: pg.httpStatus,
    api: pg.api,
    response: pg.parsed,
    raw: pg.raw.slice(0, 4000),
  });

  if (!pg.ok) {
    return { ok: false, reason: "pg_cancel_failed", message: welcomepayCancelFailMessage(pg) };
  }

  await client.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
    orderId,
  ]);

  if (paymentAttemptId) {
    await client.query(
      `UPDATE bongsim_payment_attempt SET status = 'cancelled', updated_at = now() WHERE payment_attempt_id = $1::uuid`,
      [paymentAttemptId],
    );
  }

  return { ok: true };
}

/**
 * 전액 환불 — 운영 순서 고정:
 * 1) 카드 취소 요청 접수 (`refund_requested` + 이벤트, PG 미호출)
 * 2) 유심사 API 취소
 * 3) 유심사 완료 후 PG 전액 취소 → `refunded`
 *
 * `refund_requested` 상태에서 유심사 이벤트만 있으면 3단계부터 재개(PG 실패 복구).
 */
export async function processRefund(
  orderId: string,
  reason: string,
  requestedBy: RefundRequestedBy,
): Promise<ProcessRefundResult> {
  const id = orderId.trim();
  const msg = reason.trim() || "고객 요청 환불";
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = resolveWelcomepaySignKey();
  if (!mid || !signKey) return { ok: false, reason: "welcomepay_env_incomplete" };

  const client = await pool.connect();
  try {
    // --- Phase 1: 접수 (짧은 트랜잭션) ---
    await client.query("BEGIN");

    const o1 = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, payment_reference
       FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    let order = o1.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found" };
    }

    const preCheck = await validateRefundOrder(client, order, id);
    if (preCheck) {
      await client.query("ROLLBACK");
      return preCheck;
    }

    const phase1 = await phase1RecordCardCancelRequest(client, order, id, msg, requestedBy);
    if (!phase1.ok) {
      await client.query("ROLLBACK");
      return phase1;
    }

    await client.query("COMMIT");

    // --- Phase 2: 유심사 (API → 짧은 DB 기록) ---
    let supplierResults: Array<{ topup_id: string; code: string; message: string }> | null = null;

    if (!(await hasRefundEvent(client, id, REFUND_EVENT.supplierApplied))) {
      const topupIds = await listUsimsaTopupsToCancel(client, id);
      const usimsa = await callUsimsaCancelTopups(topupIds);
      if (!usimsa.ok) {
        await client.query("BEGIN");
        const previousStatus = await getPreviousOrderStatusFromRefundRequest(client, id);
        if (previousStatus) {
          await client.query(
            `UPDATE bongsim_order SET status = $2, updated_at = now() WHERE order_id = $1::uuid`,
            [id, previousStatus],
          );
        }
        await client.query("COMMIT");
        console.error("[processRefund:phase2]", { orderId: id, message: usimsa.message });
        return { ok: false, reason: "supplier_refund_failed", message: usimsa.message };
      }
      supplierResults = usimsa.results;
    }

    await client.query("BEGIN");
    const o2 = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, payment_reference
       FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    order = o2.rows[0];
    if (!order || order.status !== "refund_requested") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status", message: order?.status ?? "missing" };
    }

    if (supplierResults && !(await hasRefundEvent(client, id, REFUND_EVENT.supplierApplied))) {
      await persistSupplierRefundApplied(client, id, msg, requestedBy, supplierResults);
    }
    await client.query("COMMIT");

    // --- Phase 3: PG 취소 승인 (API → 짧은 DB 기록) ---
    const o3read = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, payment_reference
       FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    order = o3read.rows[0];
    if (!order || order.status !== "refund_requested") {
      return { ok: false, reason: "invalid_status", message: order?.status ?? "missing" };
    }

    const pgCall = await callWelcomepayCardCancel(client, order, id, msg, mid, signKey);
    if (!pgCall.ok) return pgCall;

    await client.query("BEGIN");
    const o3 = await client.query<LockedOrder>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, payment_reference
       FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    order = o3.rows[0];
    if (!order || order.status !== "refund_requested") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status", message: order?.status ?? "missing" };
    }

    const phase3 = await persistCardCancelOutcome(
      client,
      id,
      msg,
      requestedBy,
      pgCall.tid,
      pgCall.cancelBody,
      pgCall.pg,
    );
    await client.query("COMMIT");

    if (!phase3.ok) {
      console.error("[processRefund:phase3] PG failed; order remains refund_requested for retry", {
        orderId: id,
        message: phase3.message,
      });
      return phase3;
    }

    await notifyRefundCompletedBestEffort(id);
    return { ok: true };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[processRefund]", e);
    return { ok: false, reason: "db_error", message: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}
