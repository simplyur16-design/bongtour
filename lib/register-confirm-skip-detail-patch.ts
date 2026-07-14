/**
 * confirm 시 detail/optional collect patch 재실행 생략 여부.
 * REGRESSION-FREEZE[register-confirm-skip-detail-recollect]: skip only when reuse-safe — manifest
 *
 * - hasParsed만으로 스킵 → 빈 prices/schedule → 422 REVIEW_REQUIRED
 * - DetailCollectRan만으로 스킵 → inject*PricesIfMissing까지 생략 → 가격 빈 채 422
 * - prices+schedule이 둘 다 있을 때만 전체 patch 스킵 (inject는 prices 있으면 no-op)
 */
export function shouldSkipConfirmDetailPatch(opts: {
  mode: string
  hasParsed: boolean
  reusedConfirmAnalysis: boolean
  /** @deprecated 더 이상 단독 스킵에 쓰지 않음 — 호환·로깅용 */
  detailCollectRan?: boolean | null
  pricesLen: number
  scheduleLen: number
}): boolean {
  if (opts.mode !== 'confirm') return false
  if (!(opts.hasParsed || opts.reusedConfirmAnalysis)) return false
  return opts.pricesLen > 0 && opts.scheduleLen > 0
}
