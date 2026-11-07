/**
 * remat ↔ 3축 검수 revision (rawMeta keys only — no schema).
 * lastReviewedHash vs materializedRevision.
 * REGRESSION-FREEZE[register-pending-revision-1106]: remat invalidates review-pass — manifest
 */
import { createHash } from 'node:crypto'

export const RAW_META_MATERIALIZED_REVISION_KEY = 'materializedRevision'
export const RAW_META_LAST_REVIEWED_HASH_KEY = 'lastReviewedHash'
/** 문과장 1106: 명시적 사람 검수 기록(누가·언제) — 지어낸 서명 금지, 호출자가 실제 검수자 id를 넘길 때만 기록 */
export const RAW_META_LAST_REVIEWED_BY_KEY = 'lastReviewedBy'
export const RAW_META_LAST_REVIEWED_AT_KEY = 'lastReviewedAt'
/** v3: 3축 사람 검수 감사 기록(lib/register-review-audit.ts) */
export const RAW_META_HUMAN_REVIEW_AUDIT_KEY = 'humanReviewAudit'

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
export function isReviewRevisionStale(
  rawMeta: string | null | undefined | Record<string, unknown>,
  /** 문과장 1106: 주면 검수 해시를 현재 일정 내용에 묶는다(remat 뒤 다른 경로 일정 변경도 stale) */
  currentSchedule?: string | null,
): boolean {
  const mat = readMaterializedRevision(rawMeta)
  if (!mat) return false
  const reviewed = readLastReviewedHash(rawMeta)
  if (currentSchedule !== undefined) {
    const meta =
      rawMeta && typeof rawMeta === 'object' ? rawMeta : parseProductRawMeta(rawMeta as string | null | undefined)
    // 해시만 맞춰서는 통과 불가 — 명시적 검수 기록(검수자)이 함께 있어야 함
    const by = String(meta[RAW_META_LAST_REVIEWED_BY_KEY] ?? '').trim()
    return !by || reviewed !== computeMaterializedRevision(String(currentSchedule ?? ''))
  }
  return mat !== reviewed
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
  next[RAW_META_LAST_REVIEWED_BY_KEY] = null
  next[RAW_META_LAST_REVIEWED_AT_KEY] = null
  next[RAW_META_HUMAN_REVIEW_AUDIT_KEY] = null
  return next
}
