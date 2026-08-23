/**
 * 봉투어 eSIM 할인 전 정가.
 * 25% 할인 후: 공급가 + 고객센터(공급가 10%) + 수익(공급가 15%) = 공급가 × 1.25
 * 정가 = (공급가 × 1.25) / 0.75 = 공급가 × 5/3, 10원 단위 올림.
 */
export const BONGTOUR_ESIM_CS_COST_OF_SUPPLY = 0.1;
export const BONGTOUR_ESIM_PROFIT_OF_SUPPLY = 0.15;
export const BONGTOUR_ESIM_AFFILIATION_DISCOUNT = 0.25;
export const BONGTOUR_ESIM_LIST_OVER_SUPPLY = 5 / 3;

export function bongtourEsimListPriceFromSupplyKrw(supplyKrw: number): number | null {
  if (!Number.isFinite(supplyKrw) || supplyKrw < 0) return null;
  return Math.ceil((supplyKrw * BONGTOUR_ESIM_LIST_OVER_SUPPLY) / 10) * 10;
}
