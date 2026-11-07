/**
 * 문과장 1106 v3: 3축 사람 검수 기록기 — 유일한 쓰기 경로.
 * 호출처: PATCH /api/admin/products/[id] 의 `humanReviewPass` 분기(requireAdmin 세션 사람 id) 만.
 * - remat·자동 통과 검사·사진 등록 잡에서 호출 금지(자동 채움 금지).
 * - 검수자 id·역할은 인증 세션에서만(요청 본문 금지). 시각은 서버 시계.
 * - 저장 값은 전부 서버가 현재 행에서 계산. 요청의 digest 는 "검수 화면에서 본 내용 == 지금 저장 내용" 확인용 비교값일 뿐 저장하지 않음.
 * - 승인 조건: 등록대기(pending|pre_photo_blocked) + remat revision 존재 + 사진 완결.
 * - 원자성: 트랜잭션 SELECT → 일정·rawMeta·대표사진 필드 equality updateMany(count===1).
 */
import { prisma } from '@/lib/prisma'
import { PENDING_HEAL_WRITE_STATUSES } from '@/lib/register-pending-write-guard'
import { parseProductRawMeta, readMaterializedRevision } from '@/lib/register-pending-revision'
import {
  REVIEW_EVIDENCE_ROW_SELECT,
  applyHumanReviewAuditToRawMeta,
  buildHumanReviewAudit,
  clearHumanReviewOnRawMeta,
  computeReviewEvidence,
  isHumanReviewerId,
  rawMetaHasHumanReview,
  verifyHumanReviewAudit,
  type HumanReviewAudit,
} from '@/lib/register-review-audit'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'

export type ExplicitReviewStampReason =
  | 'reviewer_not_human'
  | 'expected_digest_missing'
  | 'product_missing'
  | 'status'
  | 'no_materialized_revision'
  | 'schedule_unparseable'
  | 'photos_incomplete'
  | 'inspected_content_mismatch'
  | 'aborted_concurrent'

export type ExplicitReviewStampResult =
  | { ok: true; count: 1; audit: HumanReviewAudit }
  | { ok: false; count: 0; reason: ExplicitReviewStampReason; mismatch?: string[] }

export type InspectedDigests = {
  scheduleSha256: string
  summaryDescriptionSha256: string
  photoIdentitySha256: string
}

export async function recordExplicitHumanReviewPass(args: {
  productId: string
  /** requireAdmin() 세션 user — 요청 본문에서 받지 말 것 */
  sessionUser: { id?: string | null; role?: string | null }
  /** 검수 화면이 보여준 digest (비교 전용, 저장 안 함) */
  inspected: Partial<InspectedDigests> | null | undefined
  prismaClient?: typeof prisma
}): Promise<ExplicitReviewStampResult> {
  const reviewerId = String(args.sessionUser?.id ?? '').trim()
  if (!isHumanReviewerId(reviewerId)) return { ok: false, count: 0, reason: 'reviewer_not_human' }
  const ins = args.inspected ?? {}
  const keys: (keyof InspectedDigests)[] = ['scheduleSha256', 'summaryDescriptionSha256', 'photoIdentitySha256']
  if (keys.some((k) => typeof ins[k] !== 'string' || !/^[0-9a-f]{64}$/.test(String(ins[k])))) {
    return { ok: false, count: 0, reason: 'expected_digest_missing' }
  }
  const productId = String(args.productId ?? '').trim()
  const db = args.prismaClient ?? prisma
  return db.$transaction(async (tx) => {
    const row = await tx.product.findUnique({ where: { id: productId }, select: REVIEW_EVIDENCE_ROW_SELECT })
    if (!row) return { ok: false as const, count: 0 as const, reason: 'product_missing' as const }
    if (!(PENDING_HEAL_WRITE_STATUSES as readonly string[]).includes(String(row.registrationStatus ?? ''))) {
      return { ok: false as const, count: 0 as const, reason: 'status' as const }
    }
    const ev = computeReviewEvidence(row)
    if (!ev) return { ok: false as const, count: 0 as const, reason: 'schedule_unparseable' as const }
    if (!ev.sourceRevision) return { ok: false as const, count: 0 as const, reason: 'no_materialized_revision' as const }
    if (!isRegisterPendingPhotosReady(row.bgImageUrl, row.schedule)) {
      return { ok: false as const, count: 0 as const, reason: 'photos_incomplete' as const }
    }
    const mismatch = keys.filter((k) => ins[k] !== ev[k])
    if (mismatch.length) return { ok: false as const, count: 0 as const, reason: 'inspected_content_mismatch' as const, mismatch }
    const audit = buildHumanReviewAudit(row, { id: reviewerId, role: args.sessionUser?.role ?? null }, new Date())
    if (!audit) return { ok: false as const, count: 0 as const, reason: 'reviewer_not_human' as const }
    const next = applyHumanReviewAuditToRawMeta(parseProductRawMeta(row.rawMeta), audit)
    const upd = await tx.product.updateMany({
      where: {
        id: productId,
        registrationStatus: { in: [...PENDING_HEAL_WRITE_STATUSES] },
        schedule: row.schedule,
        rawMeta: row.rawMeta ?? null,
        bgImageUrl: row.bgImageUrl ?? null,
        bgImageExternalId: row.bgImageExternalId ?? null,
        bgImageStoragePath: row.bgImageStoragePath ?? null,
        bgImageSourceUrl: row.bgImageSourceUrl ?? null,
      },
      data: { rawMeta: JSON.stringify(next) },
    })
    if (upd.count !== 1) return { ok: false as const, count: 0 as const, reason: 'aborted_concurrent' as const }
    return { ok: true as const, count: 1 as const, audit }
  })
}

/**
 * 일정·사진이 바뀐 일반 편집 뒤 호출 — 기존 검수 기록 무효화(검증은 어차피 재계산으로 실패하지만 재사용 방지).
 * rawMeta equality 조건부 1회; 경합 시 다시 읽어 1회 재시도. 실패해도 verify 가 fail-closed.
 */
export async function clearHumanReviewAfterContentEdit(productId: string, prismaClient?: typeof prisma): Promise<boolean> {
  const db = prismaClient ?? prisma
  for (let i = 0; i < 2; i++) {
    const cur = await db.product.findUnique({ where: { id: productId }, select: { rawMeta: true } })
    if (!cur || !rawMetaHasHumanReview(cur.rawMeta)) return false
    const next = JSON.stringify(clearHumanReviewOnRawMeta(parseProductRawMeta(cur.rawMeta)))
    const upd = await db.product.updateMany({ where: { id: productId, rawMeta: cur.rawMeta ?? null }, data: { rawMeta: next } })
    if (upd.count === 1) return true
  }
  return false
}

/**
 * 문과장 1106 v4: 관리자 PATCH `registrationStatus:'registered'` 서버 가드(UI 우회 포함 — 목록·대기열 화면의 같은 본문도 여기서 걸림).
 * - 대상: remat revision(rawMeta.materializedRevision)이 있는 상품만. revision 없는 legacy·수동 상품은 기존(frozen) 동작 그대로 → required:false.
 *   auto_unpublished→재공개, 이미 registered 는 대상 아님.
 * - 대상이면: 본문은 registrationStatus 단독(내용 편집과 동시 승인 금지) + 지금 행 기준 3축 감사 기록 검증 통과 필수.
 * - 통과 시 현재 행 값(expect)을 돌려줘 route 가 equality updateMany 로 원자 승인(SELECT↔UPDATE 사이 변경 → 409).
 */
export type RegisterFlipExpect = {
  registrationStatus: string | null
  schedule: string | null
  rawMeta: string | null
  bgImageUrl: string | null
  bgImageExternalId: string | null
  bgImageStoragePath: string | null
  bgImageSourceUrl: string | null
}
export type RegisterFlipGate =
  | { required: false }
  | { required: true; ok: true; expect: RegisterFlipExpect }
  | { required: true; ok: false; reason: string }

export async function checkRegisterFlipHumanReviewGate(
  productId: string,
  bodyKeys: string[],
  prismaClient?: typeof prisma,
): Promise<RegisterFlipGate> {
  const db = prismaClient ?? prisma
  const row = await db.product.findUnique({ where: { id: productId }, select: REVIEW_EVIDENCE_ROW_SELECT })
  if (!row) return { required: false }
  const status = String(row.registrationStatus ?? '').trim()
  if (!readMaterializedRevision(row.rawMeta) || status === 'auto_unpublished' || status === 'registered') {
    return { required: false }
  }
  if (bodyKeys.some((k) => k !== 'registrationStatus')) {
    return { required: true, ok: false, reason: 'register_must_be_alone_after_saved_review' }
  }
  const v = verifyHumanReviewAudit(productId, row)
  if (!v.ok) return { required: true, ok: false, reason: v.reason }
  return {
    required: true,
    ok: true,
    expect: {
      registrationStatus: row.registrationStatus ?? null,
      schedule: row.schedule ?? null,
      rawMeta: row.rawMeta ?? null,
      bgImageUrl: row.bgImageUrl ?? null,
      bgImageExternalId: row.bgImageExternalId ?? null,
      bgImageStoragePath: row.bgImageStoragePath ?? null,
      bgImageSourceUrl: row.bgImageSourceUrl ?? null,
    },
  }
}
