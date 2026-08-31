/**
 * 목록은 200인데 상세가 5xx면 상품이 없는 게 아니다.
 * REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: 5xx ≠ Plan not found — manifest
 */
export function simplyurProductHttpViewState(
  status: number,
): "ok" | "not_found" | "unavailable" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404) return "not_found";
  return "unavailable";
}
