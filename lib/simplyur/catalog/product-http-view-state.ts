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

/** 캐시·DB 로드 실패를 Plan not found로 뭉개지 않는다. */
// REGRESSION-FREEZE[simplyur-checkout-load-state-not-found]: db/5xx → unavailable — manifest
export function simplyurCatalogLoadToViewState(
  optionApiId: string,
  loaded: { ok: true } | { ok: false; reason: string } | null,
): "loaded" | "not_found" | "unavailable" {
  if (!optionApiId.trim()) return "not_found";
  if (!loaded) return "not_found";
  if (loaded.ok) return "loaded";
  if (loaded.reason === "not_found" || loaded.reason === "not_korea") return "not_found";
  return "unavailable";
}
