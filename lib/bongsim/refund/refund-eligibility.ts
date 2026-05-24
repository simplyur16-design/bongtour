import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; code: string; message: string };

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

export async function getRefundEligibility(orderId: string): Promise<RefundEligibility> {
  const id = orderId.trim();
  const pool = getPgPool();
  if (!pool) return { eligible: false, code: "db_unconfigured", message: "DB 미설정" };

  const client = await pool.connect();
  try {
    const o = await client.query<{
      status: string;
      payment_provider: string | null;
      payment_reference: string | null;
    }>(
      `SELECT status, payment_provider, payment_reference
         FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    const order = o.rows[0];
    if (!order) return { eligible: false, code: "not_found", message: "주문을 찾을 수 없습니다." };

    if (order.status === "refunded") {
      return { eligible: false, code: "already_refunded", message: "이미 환불된 주문입니다." };
    }

    if (order.status === "refund_requested") {
      return {
        eligible: false,
        code: "refund_in_progress",
        message: "환불이 처리 중입니다. 잠시 후 새로고침해 주세요. 계속되면 고객센터로 문의해 주세요.",
      };
    }

    if (order.status !== "paid" && order.status !== "delivered") {
      return {
        eligible: false,
        code: "invalid_status",
        message: "결제 완료·발급 대기 중인 주문만 취소할 수 있습니다.",
      };
    }

    if ((order.payment_provider ?? "").trim() !== WELCOMEPAY_PROVIDER_ID) {
      return { eligible: false, code: "unsupported_provider", message: "이 결제 수단은 고객 취소를 지원하지 않습니다." };
    }

    if (!(order.payment_reference ?? "").trim()) {
      return { eligible: false, code: "missing_payment_reference", message: "결제 정보가 없어 취소할 수 없습니다." };
    }

    if (await orderHasUsimsaIccid(client, id)) {
      return {
        eligible: false,
        code: "esim_activated",
        message: "eSIM이 이미 발급·활성화되어 취소할 수 없습니다. 고객센터로 문의해 주세요.",
      };
    }

    return { eligible: true };
  } finally {
    client.release();
  }
}
