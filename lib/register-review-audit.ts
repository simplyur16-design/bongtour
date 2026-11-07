/**
 * 문과장 1106 v3: 사람 검수(3축: 일정·요약/설명·사진) 감사 기록 — 순수 함수(DB 없음).
 * - 모든 값은 서버가 현재 저장된 Product 행에서 계산한다(요청 값 저장 금지).
 * - 사진 바이트 해시는 계산하지 않는다(다운로드 없음) → photoBytesVerified=false 로 명시.
 * - rawMeta 키만 사용(스키마 변경 없음).
 */
import { createHash } from 'node:crypto'
import {
  RAW_META_HUMAN_REVIEW_AUDIT_KEY,
  RAW_META_LAST_REVIEWED_AT_KEY,
  RAW_META_LAST_REVIEWED_BY_KEY,
  RAW_META_LAST_REVIEWED_HASH_KEY,
  computeMaterializedRevision,
  parseProductRawMeta,
  readMaterializedRevision,
} from '@/lib/register-pending-revision'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'
import {
  collectReviewPhotoIdentity,
  reviewCanonicalInputs,
  type ReviewPhotoIdentity,
} from '@/lib/register-review-audit-canonical'

export const HUMAN_REVIEW_AUDIT_VERSION = 1

/** 서비스/개발 가짜 세션 id — 사람 검수자로 인정하지 않음 (lib/require-admin*.ts) */
const NON_HUMAN_ACTOR_IDS = new Set(['__service_bearer__', '__mock_admin__'])

export type ReviewEvidenceRow = {
  id: string
  schedule: string | null
  rawMeta: string | null
  originSource?: string | null
  originCode?: string | null
  originUrl?: string | null
  bgImageUrl: string | null
  bgImageExternalId: string | null
  bgImageStoragePath: string | null
  bgImageSourceUrl: string | null
}

export const REVIEW_EVIDENCE_ROW_SELECT = {
  id: true,
  schedule: true,
  rawMeta: true,
  registrationStatus: true,
  originSource: true,
  originCode: true,
  originUrl: true,
  bgImageUrl: true,
  bgImageExternalId: true,
  bgImageStoragePath: true,
  bgImageSourceUrl: true,
} as const

export type { ReviewPhotoIdentity }
export { collectReviewPhotoIdentity }

export type ReviewEvidence = {
  scheduleSha256: string
  summaryDescriptionSha256: string
  photoIdentity: ReviewPhotoIdentity[]
  photoIdentitySha256: string
  sourceRevision: string | null
  origin: { source: string | null; code: string | null; url: string | null }
}

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const s0 = (v: unknown): string | null => {
  const t = v == null ? '' : String(v).trim()
  return t ? t : null
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
export function isHumanReviewerId(id: unknown): id is string {
  const t = typeof id === 'string' ? id.trim() : ''
  return Boolean(t) && !NON_HUMAN_ACTOR_IDS.has(t) && !t.startsWith('__')
}

/** 현재 저장된 행 → 증거. 일정 JSON 이 배열이 아니면 null(검수 불가) */
export function computeReviewEvidence(row: ReviewEvidenceRow): ReviewEvidence | null {
  // 문과장 1106 v4: 정본 입력은 브라우저 helper 와 같은 함수(register-review-audit-canonical) — 서버는 node:crypto 로 같은 UTF-8 SHA-256
  const c = reviewCanonicalInputs(row)
  if (!c) return null
  return {
    scheduleSha256: computeMaterializedRevision(c.schedule),
    summaryDescriptionSha256: sha(c.summaryDescription),
    photoIdentity: c.photoList,
    photoIdentitySha256: sha(c.photoIdentity),
    sourceRevision: readMaterializedRevision(row.rawMeta) || null,
    origin: { source: s0(row.originSource), code: s0(row.originCode), url: s0(row.originUrl) },
  }
}

export type HumanReviewAudit = ReviewEvidence & {
  v: number
  productId: string
  reviewerId: string
  reviewerRole: string | null
  reviewedAt: string
  photoBytesVerified: false
}

export function buildHumanReviewAudit(
  row: ReviewEvidenceRow,
  reviewer: { id: string; role: string | null },
  reviewedAt: Date,
): HumanReviewAudit | null {
  const ev = computeReviewEvidence(row)
  if (!ev || !isHumanReviewerId(reviewer.id)) return null
  return {
    v: HUMAN_REVIEW_AUDIT_VERSION,
    productId: row.id,
    ...ev,
    reviewerId: reviewer.id.trim(),
    reviewerRole: reviewer.role ?? null,
    reviewedAt: reviewedAt.toISOString(),
    photoBytesVerified: false,
  }
}

export function applyHumanReviewAuditToRawMeta(meta: Record<string, unknown>, audit: HumanReviewAudit): Record<string, unknown> {
  return {
    ...meta,
    [RAW_META_HUMAN_REVIEW_AUDIT_KEY]: audit,
    [RAW_META_LAST_REVIEWED_HASH_KEY]: audit.scheduleSha256,
    [RAW_META_LAST_REVIEWED_BY_KEY]: audit.reviewerId,
    [RAW_META_LAST_REVIEWED_AT_KEY]: audit.reviewedAt,
  }
}

export function clearHumanReviewOnRawMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return {
    ...meta,
    [RAW_META_HUMAN_REVIEW_AUDIT_KEY]: null,
    [RAW_META_LAST_REVIEWED_HASH_KEY]: null,
    [RAW_META_LAST_REVIEWED_BY_KEY]: null,
    [RAW_META_LAST_REVIEWED_AT_KEY]: null,
  }
}

export function rawMetaHasHumanReview(rawMeta: string | null | undefined): boolean {
  const m = parseProductRawMeta(rawMeta)
  return [RAW_META_HUMAN_REVIEW_AUDIT_KEY, RAW_META_LAST_REVIEWED_HASH_KEY, RAW_META_LAST_REVIEWED_BY_KEY, RAW_META_LAST_REVIEWED_AT_KEY].some(
    (k) => m[k] != null,
  )
}

export type AuditVerifyResult = { ok: true } | { ok: false; reason: string }

/** 저장된 감사 기록이 '지금 행'의 일정·요약/설명·사진·원천 revision 과 전부 같은지 (fail-closed) */
export function verifyHumanReviewAudit(productId: string, row: ReviewEvidenceRow, now: Date = new Date()): AuditVerifyResult {
  if (row.id !== productId) return { ok: false, reason: 'row_product_mismatch' }
  const meta = parseProductRawMeta(row.rawMeta)
  const a = obj(meta[RAW_META_HUMAN_REVIEW_AUDIT_KEY]) as Partial<HumanReviewAudit>
  if (a.v !== HUMAN_REVIEW_AUDIT_VERSION) return { ok: false, reason: 'audit_missing' }
  if (a.productId !== productId) return { ok: false, reason: 'audit_product_mismatch' }
  if (!isHumanReviewerId(a.reviewerId)) return { ok: false, reason: 'reviewer_not_human' }
  const at = Date.parse(String(a.reviewedAt ?? ''))
  if (!Number.isFinite(at) || at > now.getTime() + 60_000) return { ok: false, reason: 'reviewed_at_invalid' }
  const ev = computeReviewEvidence(row)
  if (!ev) return { ok: false, reason: 'schedule_unparseable' }
  if (!ev.sourceRevision) return { ok: false, reason: 'no_materialized_revision' }
  if (a.sourceRevision !== ev.sourceRevision) return { ok: false, reason: 'source_revision_changed' }
  if (a.scheduleSha256 !== ev.scheduleSha256) return { ok: false, reason: 'schedule_changed' }
  if (a.summaryDescriptionSha256 !== ev.summaryDescriptionSha256) return { ok: false, reason: 'summary_description_changed' }
  if (a.photoIdentitySha256 !== ev.photoIdentitySha256 || JSON.stringify(a.photoIdentity) !== JSON.stringify(ev.photoIdentity)) {
    return { ok: false, reason: 'photo_identity_changed' }
  }
  if (JSON.stringify(a.origin) !== JSON.stringify(ev.origin)) return { ok: false, reason: 'origin_changed' }
  if (meta[RAW_META_LAST_REVIEWED_HASH_KEY] !== ev.scheduleSha256 || meta[RAW_META_LAST_REVIEWED_BY_KEY] !== a.reviewerId) {
    return { ok: false, reason: 'legacy_keys_inconsistent' }
  }
  if (!isRegisterPendingPhotosReady(row.bgImageUrl, row.schedule)) return { ok: false, reason: 'photos_incomplete' }
  return { ok: true }
}
