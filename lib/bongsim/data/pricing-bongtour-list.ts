/**
 * 홈(봉투어) 가격 SSOT.
 * 홈 표시·일반 청구 = 권장소비자가(`recommended_krw`). 그 아래로 표시하지 않음.
 * 명함 25% 마지노선 = 공급가×1.25(CS 10% + 수익 15%). 그 밑으로 깎지 않음.
 * REGRESSION-FREEZE[bongsim-display-recommended-floor]: 표시=권장소비자가 · 명함 마지노선 1.25 — manifest
 */
export const BONGTOUR_ESIM_CS_COST_OF_SUPPLY = 0.1;
export const BONGTOUR_ESIM_PROFIT_OF_SUPPLY = 0.15;
export const BONGTOUR_ESIM_AFFILIATION_DISCOUNT = 0.25;
export const BONGTOUR_ESIM_AFFILIATION_NET_OVER_SUPPLY = 1.25;
/** 권장소비자가·소비자가 없을 때 마지막 폴백 */
export const BONGTOUR_ESIM_LIST_OVER_SUPPLY = 5 / 3;

export function roundKrwUpTo10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

/** 홈 표시가 — 권장소비자가. 없으면 소비자가, 그다음 공급 폴백. */
export function bongtourHomepageListKrw(opts: {
  recommended_krw: number | null;
  consumer_krw: number | null;
  supply_krw: number | null;
}): number | null {
  const recommended =
    opts.recommended_krw == null || opts.recommended_krw < 0 ? null : Math.trunc(opts.recommended_krw);
  if (recommended != null) return recommended;
  const consumer = opts.consumer_krw == null || opts.consumer_krw < 0 ? null : Math.trunc(opts.consumer_krw);
  if (consumer != null) return consumer;
  if (opts.supply_krw == null) return null;
  return bongtourEsimListPriceFromSupplyKrw(opts.supply_krw);
}

/** 명함 25% 후 최소 잔액 = 공급가 × 1.25, 10원 올림. */
export function bongtourAffiliationFloorNetFromSupplyKrw(supplyKrw: number): number | null {
  if (!Number.isFinite(supplyKrw) || supplyKrw < 0) return null;
  return roundKrwUpTo10(supplyKrw * BONGTOUR_ESIM_AFFILIATION_NET_OVER_SUPPLY);
}

/** 권장·소비자가 없을 때만 쓰는 폴백. 홈 표시 정의가 아님. */
export function bongtourEsimListPriceFromSupplyKrw(supplyKrw: number): number | null {
  if (!Number.isFinite(supplyKrw) || supplyKrw < 0) return null;
  return roundKrwUpTo10(supplyKrw * BONGTOUR_ESIM_LIST_OVER_SUPPLY);
}
