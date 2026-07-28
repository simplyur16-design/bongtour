/** 유심사 일별 usage — 이 값(MB) 이하면 미사용. */
// REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: unused epsilon SSOT — manifest
export const USIMSA_USAGE_MB_EPSILON = 0.01;

export function isUsimsaUnusedMb(totalUsedMb: number): boolean {
  return Number.isFinite(totalUsedMb) && totalUsedMb <= USIMSA_USAGE_MB_EPSILON;
}
