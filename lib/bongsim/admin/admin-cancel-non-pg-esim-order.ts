/**
 * 무상(complimentary)·오프라인(offline) eSIM/USIM — PG 없이 유심사 취소 + 주문 refunded.
 * REGRESSION-FREEZE[bongsim-admin-non-pg-esim-cancel]: manifest
 */
import { randomBytes } from "node:crypto";
import {
  COMPLIMENTARY_ESIM_PAYMENT_PROVIDER,
  isComplimentaryEsimOrder,
} from "@/lib/bongsim/admin/complimentary-esim-order";
import {
  OFFLINE_PAYMENT_PROVIDER,
  parseOfflineUsimConsents,
} from "@/lib/bongsim/admin/offline-usim-order";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { terminalPendingEsimQrNotifyForOrder } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";
import { checkUsimsaOrderDataUsageForRefund } from "@/lib/bongsim/refund/usimsa-refund-usage";
import {
  cancelUsimsaTopup,
  cancelUsimsaUsimTopup,
  UsimsaCancelError,
} from "@/lib/bongsim/supplier/usimsa/order-api";

export const NON_PG_CANCEL_PROVIDERS = [
  COMPLIMENTARY_ESIM_PAYMENT_PROVIDER,
  OFFLINE_PAYMENT_PROVIDER,
] as const;

export type AdminNonPgEsimCancelResult =
  | { ok: true; canceled_topup_ids: string[] }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "order_not_found"
        | "invalid_status"
        | "not_non_pg_order"
        | "already_refunded"
        | "esim_used_no_refund"
        | "usage_check_failed"
        | "supplier_cancel_failed"
        | "db_error";
      message?: string;
    };

type TopupRow = {
  topup_id: string;
  fulfillment_mode: string;
};

function isNonPgProvider(provider: string | null | undefined, consents: unknown): boolean {
  const p = String(provider ?? "").trim();
  if (p === COMPLIMENTARY_ESIM_PAYMENT_PROVIDER || p === OFFLINE_PAYMENT_PROVIDER) return true;
  if (isComplimentaryEsimOrder(consents)) return true;
  if (parseOfflineUsimConsents(consents) != null) return true;
  return false;
}

async function cancelSupplierTopups(
  rows: TopupRow[],
): Promise<
  | { ok: true; results: Array<{ topup_id: string; code: string; message: string }> }
  | { ok: false; message: string }
> {
  const results: Array<{ topup_id: string; code: string; message: string }> = [];
  try {
    for (const row of rows) {
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

/**
 * 관리자 — 무상/오프라인 주문 유심사 취소 후 `refunded` (카드 PG 호출 없음).
 */
export async function adminCancelNonPgEsimOrder(
  orderId: string,
  reason: string,
  adminId: string,
): Promise<AdminNonPgEsimCancelResult> {
  const id = orderId.trim();
  const msg = reason.trim() || "관리자 무상·오프라인 eSIM 취소";
  const by = String(adminId ?? "").trim() || "admin";
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    const o = await client.query<{
      order_id: string;
      status: string;
      payment_provider: string | null;
      consents: unknown;
    }>(
      `SELECT order_id::text, status, payment_provider, consents
         FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    const order = o.rows[0];
    if (!order) return { ok: false, reason: "order_not_found" };

    if (order.status === "refunded" || order.status === "cancelled") {
      return { ok: false, reason: "already_refunded", message: "이미 취소·환불된 주문입니다." };
    }

    if (order.status !== "paid" && order.status !== "delivered") {
      return {
        ok: false,
        reason: "invalid_status",
        message: `취소 불가 상태: ${order.status}`,
      };
    }

    if (!isNonPgProvider(order.payment_provider, order.consents)) {
      return {
        ok: false,
        reason: "not_non_pg_order",
        message: "무상·오프라인 주문만 이 취소로 처리할 수 있습니다. 일반 결제는 「환불」을 사용하세요.",
      };
    }

    const usage = await checkUsimsaOrderDataUsageForRefund(id, client);
    if (!usage.ok) {
      if (usage.reason === "esim_used") {
        return { ok: false, reason: "esim_used_no_refund", message: usage.message };
      }
      return { ok: false, reason: "usage_check_failed", message: usage.message };
    }

    const tops = await client.query<TopupRow>(
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
      [id],
    );

    const cancel = await cancelSupplierTopups(tops.rows);
    if (!cancel.ok) {
      return { ok: false, reason: "supplier_cancel_failed", message: cancel.message };
    }

    await client.query("BEGIN");
    try {
      for (const row of cancel.results) {
        await client.query(
          `UPDATE bongsim_fulfillment_topup
              SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
            WHERE topup_id = $1`,
          [row.topup_id],
        );
      }

      await client.query(
        `UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`,
        [id],
      );
      // REGRESSION-FREEZE[bongsim-esim-qr-notify-skip-terminal-order]: non-PG cancel cancels pending QR notify — manifest
      await terminalPendingEsimQrNotifyForOrder(client, id, "refunded");

      await client.query(
        `UPDATE bongsim_payment_attempt
            SET status = 'cancelled', updated_at = now()
          WHERE order_id = $1::uuid AND status = 'captured'`,
        [id],
      );

      const eventId = `admin_non_pg_cancel_${id}_${Date.now()}_${randomBytes(4).toString("hex")}`;
      const attempt = await client.query<{ payment_attempt_id: string }>(
        `SELECT payment_attempt_id::text FROM bongsim_payment_attempt
          WHERE order_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      const paymentAttemptId = attempt.rows[0]?.payment_attempt_id ?? null;
      const provider = String(order.payment_provider ?? COMPLIMENTARY_ESIM_PAYMENT_PROVIDER);

      await client.query(
        `INSERT INTO bongsim_payment_provider_event (provider, provider_event_id, payment_attempt_id, order_id, payload_json)
         VALUES ($1, $2, $3::uuid, $4::uuid, $5::jsonb)
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [
          provider,
          eventId,
          paymentAttemptId,
          id,
          JSON.stringify({
            direction: "admin_non_pg_esim_cancel",
            reason: msg,
            admin_id: by,
            topups: cancel.results,
          }),
        ],
      );

      await client.query("COMMIT");
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        reason: "db_error",
        message: e instanceof Error ? e.message : String(e),
      };
    }

    return {
      ok: true,
      canceled_topup_ids: cancel.results.map((r) => r.topup_id),
    };
  } finally {
    client.release();
  }
}
