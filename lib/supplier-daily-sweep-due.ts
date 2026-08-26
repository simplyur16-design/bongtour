/**
 * 일일 가격 sweep due-select SSOT.
 * 5분 판매정책 회전 시각으로 due를 잡으면 hanatour/ybtour/verygoodtour 가 기아된다.
 * REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
 */

export const SUPPLIER_DAILY_SWEEP_DUE_DAYS = 1

export function supplierDailySweepDueCutoff(nowMs: number = Date.now()): Date {
  return new Date(nowMs - SUPPLIER_DAILY_SWEEP_DUE_DAYS * 24 * 60 * 60 * 1000)
}

export function supplierDailySweepDueOr(cutoff: Date) {
  return [{ lastPriceObservedAt: null }, { lastPriceObservedAt: { lt: cutoff } }] as const
}

export function supplierDailySweepDueOrderBy() {
  return [
    { lastPriceObservedAt: { sort: 'asc' as const, nulls: 'first' as const } },
    { id: 'asc' as const },
  ]
}
