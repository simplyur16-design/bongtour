/** 결제 확정 이후(이행·배송 포함) 주문 완료 화면으로 넘길 수 있는 상태 */
export const BONGSIM_POST_PAYMENT_ORDER_STATUSES = [
  "paid",
  "fulfillment_queued",
  "fulfillment_in_progress",
  "fulfilled",
  "delivered",
] as const;

export type BongsimPostPaymentOrderStatus = (typeof BONGSIM_POST_PAYMENT_ORDER_STATUSES)[number];

export function isBongsimOrderPaymentSettled(status: string): boolean {
  return (BONGSIM_POST_PAYMENT_ORDER_STATUSES as readonly string[]).includes(status);
}
