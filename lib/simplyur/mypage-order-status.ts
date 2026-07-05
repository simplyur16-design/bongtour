export type SimplyurOrderStatusKey =
  | "ordered"
  | "paid"
  | "delivered"
  | "active"
  | "failed"
  | "cancelled"
  | "refundPending";

type TopupRow = { status: string };

/** Order lifecycle → i18n key (never Korean display strings on simplyur). */
export function simplyurOrderStatusKey(orderStatus: string, topups: TopupRow[]): SimplyurOrderStatusKey {
  if (orderStatus === "awaiting_payment") return "ordered";
  if (orderStatus === "paid") return "paid";
  if (orderStatus === "delivered") {
    const hasIccidLike = topups.some((t) => t.status === "iccid_ready" || t.status === "delivered");
    return hasIccidLike ? "active" : "delivered";
  }
  if (orderStatus === "failed") return "failed";
  if (orderStatus === "cancelled" || orderStatus === "refunded") return "cancelled";
  if (orderStatus === "refund_requested") return "refundPending";
  return "ordered";
}
