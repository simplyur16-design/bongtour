import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import {
  buildWelcomepayCancelFormBody,
  encodeWelcomepayCancelNvp,
  welcomepayPayapiCancelUrl,
} from "@/lib/bongsim/welcomepay-payapi-cancel";

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
        | "pg_cancel_failed"
        | "already_refunded"
        | "db_error";
      message?: string;
    };

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

/**
 * 관리자 전액 환불 (웰컴페이먼츠).
 * - 주문 `paid` / `delivered` 만 허용.
 * - USIMSA topup에 ICCID가 채워진 경우(프로파일 발급 이후) 환불 거절.
 */
export async function processRefund(orderId: string, reason: string, adminId: string): Promise<ProcessRefundResult> {
  const id = orderId.trim();
  const msg = reason.trim() || "고객 요청 환불";
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  if (!mid || !signKey) return { ok: false, reason: "welcomepay_env_incomplete" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const o = await client.query<{
      order_id: string;
      status: string;
      grand_total_krw: string;
      payment_provider: string | null;
      payment_reference: string | null;
    }>(
      `SELECT order_id::text, status, grand_total_krw::text, payment_provider, payment_reference
       FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [id],
    );
    const order = o.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found" };
    }

    if (order.status === "refunded") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already_refunded" };
    }

    if (order.status !== "paid" && order.status !== "delivered") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status", message: order.status };
    }

    if ((order.payment_provider ?? "").trim() !== WELCOMEPAY_PROVIDER_ID) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unsupported_provider", message: order.payment_provider ?? "" };
    }

    const tid = (order.payment_reference ?? "").trim();
    if (!tid) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "missing_payment_reference" };
    }

    const activated = await orderHasUsimsaIccid(client, id);
    if (activated) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "esim_activated_no_refund" };
    }

    const priceKrw = Number.parseInt(order.grand_total_krw, 10);
    if (!Number.isFinite(priceKrw) || priceKrw <= 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_error", message: "invalid_grand_total" };
    }

    const att = await client.query<{ payment_attempt_id: string | null }>(
      `SELECT payment_attempt_id::text AS payment_attempt_id
         FROM bongsim_payment_attempt
        WHERE order_id = $1::uuid AND provider = $2 AND status = 'captured'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      [id, WELCOMEPAY_PROVIDER_ID],
    );
    const paymentAttemptId = att.rows[0]?.payment_attempt_id ?? null;

    const cancelBody = buildWelcomepayCancelFormBody({
      signKey,
      mid,
      tid,
      msg,
      priceKrw,
    });

    const url = welcomepayPayapiCancelUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: encodeWelcomepayCancelNvp(cancelBody),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }

    const resultCode = String(parsed.resultCode ?? parsed.ResultCode ?? "").trim();
    const resultMsg = String(parsed.resultMsg ?? parsed.ResultMsg ?? "").trim();
    const okPg = resultCode === "00" || resultCode === "0000";

    const providerEventId = `welcomepay_refund_${tid}_${cancelBody.timestamp}_${randomBytes(4).toString("hex")}`;

    await insertRefundProviderEvent(client, providerEventId, paymentAttemptId, id, {
      direction: "outbound_refund",
      admin_id: adminId,
      reason: msg,
      request: cancelBody,
      http_status: res.status,
      response: parsed,
    });

    if (!res.ok || !okPg) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "pg_cancel_failed",
        message: resultMsg || text.slice(0, 500) || `http_${res.status}`,
      };
    }

    await client.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
      id,
    ]);

    if (paymentAttemptId) {
      await client.query(
        `UPDATE bongsim_payment_attempt SET status = 'cancelled', updated_at = now() WHERE payment_attempt_id = $1::uuid`,
        [paymentAttemptId],
      );
    }

    await client.query("COMMIT");
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
