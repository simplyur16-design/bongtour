/** REGRESSION-FREEZE[bongsim-admin-payments-pagination]: 목록 페이지 clamp — manifest */
export function clampAdminListPage(page: number, totalPages: number): number {
  const total = Math.max(1, Math.floor(Number(totalPages)) || 1);
  const p = Math.floor(Number(page)) || 1;
  return Math.max(1, Math.min(total, p));
}
