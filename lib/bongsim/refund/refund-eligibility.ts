import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { checkUsimsaOrderDataUsageForRefund } from "@/lib/bongsim/refund/usimsa-refund-usage";

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; code: string; message: string };

export type RefundEligibilityOptions = {
  /** 마이페이지 목록 등 — 유심사 사용량 API는 취소 클릭 시 서버에서만 검증 */
  skipUsageCheck?: boolean;
};

export async function getRefundEligibility(
  orderId: string,
  options?: RefundEligibilityOptions,
): Promise<RefundEligibility> {
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
        message:
          "결제가 완료된 주문만 취소할 수 있습니다. 결제 실패·대기 중이면 주문이 확정되지 않아 취소 메뉴가 없습니다.",
      };
    }

    if ((order.payment_provider ?? "").trim() !== WELCOMEPAY_PROVIDER_ID) {
      return { eligible: false, code: "unsupported_provider", message: "이 결제 수단은 고객 취소를 지원하지 않습니다." };
    }

    if (!(order.payment_reference ?? "").trim()) {
      return { eligible: false, code: "missing_payment_reference", message: "결제 정보가 없어 취소할 수 없습니다." };
    }

    if (options?.skipUsageCheck) {
      return { eligible: true };
    }

    const usage = await checkUsimsaOrderDataUsageForRefund(id, client);
    if (!usage.ok) {
      if (usage.reason === "esim_used") {
        return { eligible: false, code: "esim_used", message: usage.message };
      }
      return { eligible: false, code: "usage_check_failed", message: usage.message };
    }

    return { eligible: true };
  } finally {
    client.release();
  }
}
