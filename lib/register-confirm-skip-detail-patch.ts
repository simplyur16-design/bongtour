/**
 * confirm 시 detail/optional collect patch 재실행 생략 여부.
 * REGRESSION-FREEZE[register-confirm-skip-detail-recollect]: skip only when reuse-safe — manifest
 *
 * hasParsed만으로 스킵하면 preview에서 prices/schedule이 비어 있거나
 * DetailCollectRan이 strip된 구 세션에서 캘린더 신호가 비어 422 REVIEW_REQUIRED가 난다.
 */
export function shouldSkipConfirmDetailPatch(opts: {
  mode: string
  hasParsed: boolean
  reusedConfirmAnalysis: boolean
  detailCollectRan?: boolean | null
  pricesLen: number
  scheduleLen: number
}): boolean {
  if (opts.mode !== 'confirm') return false
  if (!(opts.hasParsed || opts.reusedConfirmAnalysis)) return false
  if (opts.detailCollectRan === true) return true
  return opts.pricesLen > 0 && opts.scheduleLen > 0
}
