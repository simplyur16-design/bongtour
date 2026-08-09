import { getPgPool } from "@/lib/bongsim/db/pool";
import { checkUsimsaOrderDataUsageForRefund } from "@/lib/bongsim/refund/usimsa-refund-usage";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { resolveEximbayCancelRefs } from "@/lib/simplyur/refund/resolve-eximbay-cancel-refs";

// REGRESSION-FREEZE[simplyur-eximbay-refund]: unused eSIM + Eximbay cancel eligibility — manifest

export type SimplyurRefundEligibility =
  | { eligible: true }
  | { eligible: false; code: string; message: string };

export type SimplyurRefundEligibilityOptions = {
  /** List UI — usage API only on cancel click */
  skipUsageCheck?: boolean;
};

export async function getSimplyurRefundEligibility(
  orderId: string,
  options?: SimplyurRefundEligibilityOptions,
): Promise<SimplyurRefundEligibility> {
  const id = orderId.trim();
  const pool = getPgPool();
  if (!pool) return { eligible: false, code: "db_unconfigured", message: "Service unavailable." };

  const client = await pool.connect();
  try {
    const o = await client.query<{
      status: string;
      payment_provider: string | null;
      checkout_channel: string | null;
    }>(
      `SELECT status, payment_provider, checkout_channel
         FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    const order = o.rows[0];
    if (!order) return { eligible: false, code: "not_found", message: "Order not found." };

    if (!(order.checkout_channel ?? "").startsWith("simplyur_")) {
      return {
        eligible: false,
        code: "not_simplyur_order",
        message: "This order cannot be cancelled here.",
      };
    }

    if (order.status === "refunded") {
      return { eligible: false, code: "already_refunded", message: "This order was already refunded." };
    }

    if (order.status === "refund_requested") {
      return {
        eligible: false,
        code: "refund_in_progress",
        message: "Refund is already in progress. Refresh in a moment.",
      };
    }

    if (order.status !== "paid" && order.status !== "delivered") {
      return {
        eligible: false,
        code: "invalid_status",
        message: "Only paid or delivered orders can be cancelled.",
      };
    }

    if ((order.payment_provider ?? "").trim() !== SIMPLYUR_EXIMBAY_PROVIDER_ID) {
      return {
        eligible: false,
        code: "unsupported_provider",
        message: "This payment method cannot be cancelled in the app yet.",
      };
    }

    const refs = await resolveEximbayCancelRefs(client, id);
    if (!refs) {
      return {
        eligible: false,
        code: "missing_payment_reference",
        message: "Payment reference missing — contact support.",
      };
    }

    if (options?.skipUsageCheck) {
      return { eligible: true };
    }

    const usage = await checkUsimsaOrderDataUsageForRefund(id, client);
    if (!usage.ok) {
      if (usage.reason === "esim_used") {
        return {
          eligible: false,
          code: "esim_used",
          message: "This eSIM has already used data, so it cannot be refunded.",
        };
      }
      return {
        eligible: false,
        code: "usage_check_failed",
        message: "Could not verify data usage. Try again or contact support.",
      };
    }

    return { eligible: true };
  } finally {
    client.release();
  }
}
