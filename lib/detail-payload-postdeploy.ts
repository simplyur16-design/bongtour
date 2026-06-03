/** 배포(release) 직후 상세 DTO 백필 — `next build` 단계에서는 실행하지 않음 */

export const POSTDEPLOY_DETAIL_PAYLOAD_BATCH_DEFAULT = 40

export function postdeployDetailPayloadBatchSize(): number {
  const raw = process.env.POSTDEPLOY_DETAIL_PAYLOAD_BATCH?.trim()
  if (!raw) return POSTDEPLOY_DETAIL_PAYLOAD_BATCH_DEFAULT
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 200) : POSTDEPLOY_DETAIL_PAYLOAD_BATCH_DEFAULT
}

/**
 * - `next build` / CI 이미지 빌드: DB 없음 → skip
 * - `SKIP_POSTDEPLOY_DETAIL_PAYLOAD_BACKFILL=1`: Railway release command 비활성
 * - `DATABASE_URL` 없음: skip
 */
export function shouldSkipPostdeployDetailPayloadBackfill(): boolean {
  if (process.env.SKIP_POSTDEPLOY_DETAIL_PAYLOAD_BACKFILL === '1') return true
  if (process.env.NEXT_PHASE === 'phase-production-build') return true
  if (!process.env.DATABASE_URL?.trim()) return true
  return false
}
