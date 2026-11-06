/**
 * remat ↔ 3축 검수 revision (rawMeta keys only — no schema).
 * lastReviewedHash vs materializedRevision.
 * REGRESSION-FREEZE[register-pending-revision-1106]: remat invalidates review-pass — manifest
 */
import { createHash } from 'node:crypto'

export const RAW_META_MATERIALIZED_REVISION_KEY = 'materializedRevision'
export const RAW_META_LAST_REVIEWED_HASH_KEY = 'lastReviewedHash'

export function computeMaterializedRevision(scheduleJson: string): string {
  return createHash('sha256').update(String(scheduleJson ?? ''), 'utf8').digest('hex')
}

export function parseProductRawMeta(raw: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(String(raw ?? '{}')) as unknown
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

export function readMaterializedRevision(rawMeta: string | null | undefined | Record<string, unknown>): string {
  const meta =
    rawMeta && typeof rawMeta === 'object' ? rawMeta : parseProductRawMeta(rawMeta as string | null | undefined)
  return String(meta[RAW_META_MATERIALIZED_REVISION_KEY] ?? '').trim()
}

export function readLastReviewedHash(rawMeta: string | null | undefined | Record<string, unknown>): string {
  const meta =
    rawMeta && typeof rawMeta === 'object' ? rawMeta : parseProductRawMeta(rawMeta as string | null | undefined)
  return String(meta[RAW_META_LAST_REVIEWED_HASH_KEY] ?? '').trim()
}

/** remat 후 materializedRevision이 있고 lastReviewedHash와 다르면 3축 재검수 필요 */
export function isReviewRevisionStale(rawMeta: string | null | undefined | Record<string, unknown>): boolean {
  const mat = readMaterializedRevision(rawMeta)
  if (!mat) return false
  return mat !== readLastReviewedHash(rawMeta)
}

/** remat 성공 시 revision 기록 + 기존 검수 해시 무효화 */
export function stampRematRevisionOnRawMeta(
  rawMeta: Record<string, unknown>,
  scheduleJson: string,
  rematStamp?: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...rawMeta }
  if (rematStamp) Object.assign(next, rematStamp)
  next[RAW_META_MATERIALIZED_REVISION_KEY] = computeMaterializedRevision(scheduleJson)
  next[RAW_META_LAST_REVIEWED_HASH_KEY] = null
  return next
}
