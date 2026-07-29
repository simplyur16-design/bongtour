/** REGRESSION-FREEZE[bongsim-admin-payments-pagination]: 목록 페이지 clamp — manifest */
export function clampAdminListPage(page: number, totalPages: number): number {
  const total = Math.max(1, Math.floor(Number(totalPages)) || 1);
  const p = Math.floor(Number(page)) || 1;
  return Math.max(1, Math.min(total, p));
}

/** count 결과로 total_pages를 구한 뒤, 요청 page·offset을 안전한 범위로 맞춘다. */
export function resolveAdminListPaging(input: {
  page: number;
  pageSize: number;
  totalCount: number;
}): { page: number; totalPages: number; offset: number } {
  const pageSize = Math.max(1, Math.floor(Number(input.pageSize)) || 1);
  const totalCount = Math.max(0, Math.floor(Number(input.totalCount)) || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = clampAdminListPage(input.page, totalPages);
  return { page, totalPages, offset: (page - 1) * pageSize };
}
