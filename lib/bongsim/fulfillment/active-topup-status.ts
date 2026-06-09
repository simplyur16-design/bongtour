/** 환불·취소 대상에서 제외되는 topup 상태 */
export const BONGSIM_INACTIVE_TOPUP_STATUSES = ["canceled", "failed"] as const;

export function isActiveBongsimTopupStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return !BONGSIM_INACTIVE_TOPUP_STATUSES.includes(s as (typeof BONGSIM_INACTIVE_TOPUP_STATUSES)[number]);
}

/** SQL `WHERE` 절용 — `bongsim_fulfillment_topup.status` */
export const BONGSIM_ACTIVE_TOPUP_SQL = `status NOT IN ('canceled', 'failed')`;

export function isBongsimOrderEsimRevoked(orderStatus: string): boolean {
  const s = orderStatus.trim().toLowerCase();
  return s === "refunded" || s === "cancelled" || s === "refund_requested";
}
