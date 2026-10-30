/**
 * WORK-ORDER 8 3단계(준비): 기존 상품 대표 사진 보충/교체 계획 — 순수 판정(쓰기 없음).
 * 순서: Pexels → Unsplash/CC0 → AI(생성 표시). 기존 iStock(허용 목록)은 유지(pkg-yb-0004 940px 포함, 사장님 10/30).
 * 자체 사진 7장(허용 목록)은 유지(사장님 10/30 19:34 "자체 사진 7장 허용해"). 생성 이미지는 생성 표시+prompt 둘 다 있어야 통과.
 * 공개 중 교체는 50개씩 배치 + 문과장 승인 파일이 있을 때만 씀(사장님 10/30 19:34 "배포 뒤 50개씩 문과장 검수 받고 바꿔").
 * Pexels·Unsplash·CC0 출처 기록은 만들지도 채우지도 않음(의무 아님, 사장님 10/30).
 * REGRESSION-FREEZE[product-image-backfill-plan]: 기본 dry-run·기존 iStock 유지·이미지 칸만·출처 기록 안 만듦 — manifest
 */
import { createHash } from 'crypto'
import {
  IMAGE_SOURCE_TIER_ORDER,
  isOwnedBongtourImage,
  evaluateImageCandidatePolicy,
  isExistingIstockImage,
  resolveImageSourceTier,
  type ImagePolicyFailCode,
} from '@/lib/product-image-source-policy'

/** 보충 때 쓸 출처 순서 (정책 SSOT 순서 그대로) */
export const BACKFILL_SOURCE_ORDER = IMAGE_SOURCE_TIER_ORDER

/** 백필이 쓸 수 있는 칸 — 이외 칸은 절대 쓰지 않음. 출처 기록 칸(작가·원본링크·ID)은 없음. */
export const BACKFILL_WRITABLE_FIELDS = [
  'bgImageUrl',
  'bgImageSource',
  'bgImageSourceType',
  'bgImageWidth',
  'bgImageHeight',
  'bgImageIsGenerated',
  'bgImageAiPrompt',
  'bgImageAiLabeledAt',
] as const

/** 백업에 담는 칸(현재 값 전부) */
export const BACKFILL_BACKUP_FIELDS = [
  'id',
  'slug',
  'registrationStatus',
  'bgImageUrl',
  'bgImageSource',
  'bgImageSourceType',
  'bgImagePhotographer',
  'bgImageSourceUrl',
  'bgImageExternalId',
  'bgImageStoragePath',
  'bgImageStorageBucket',
  'bgImageWidth',
  'bgImageHeight',
  'bgImageIsGenerated',
  'bgImageAiPrompt',
  'bgImageAiLabeledAt',
  'needsImageReview',
] as const

export type BackfillProductRow = {
  id: string
  slug: string | null
  registrationStatus: string | null
  bgImageUrl: string | null
  bgImageSource: string | null
  bgImageSourceUrl?: string | null
  bgImageWidth: number | null
  bgImageIsGenerated: boolean | null
  /** 마이그레이션 20261030200000 적용 전에는 undefined */
  bgImageAiPrompt?: string | null
}

export type BackfillAction =
  | 'fill_cover' // 대표 사진 없음 → 보충
  | 'replace_cover' // 정책 불합격(해상도·출처) → 교체
  | 'measure_width' // 가로폭 측정 실패 → 사람 확인
  | 'ai_missing_record' // 생성 이미지인데 생성 표시 또는 prompt 기록 없음 → 실제 prompt 기록(지어내지 않음) 또는 교체
  | 'keep_existing_istock'
  | 'keep_own_photo' // 봉투어 자체 사진 7장(허용 목록) — 사장님 허용
  | 'ok'

export type BackfillClassification = {
  action: BackfillAction
  fails: ImagePolicyFailCode[] | ['NO-COVER']
  note?: string
}

export function classifyBackfillRow(row: BackfillProductRow, measuredWidth: number | null = null): BackfillClassification {
  const url = (row.bgImageUrl ?? '').trim()
  if (!url) return { action: 'fill_cover', fails: ['NO-COVER'] }
  const width = row.bgImageWidth && row.bgImageWidth > 0 ? row.bgImageWidth : measuredWidth
  if (isExistingIstockImage(url)) {
    return { action: 'keep_existing_istock', fails: [], note: width && width < 1200 ? `owner_kept_low_res:${width}` : undefined }
  }
  if (isOwnedBongtourImage(url)) {
    return { action: 'keep_own_photo', fails: [], note: width && width < 1200 ? `owner_kept_low_res:${width}` : undefined }
  }
  const cand = {
    source: row.bgImageSource,
    url,
    originalLink: row.bgImageSourceUrl ?? null,
    isGenerated: row.bgImageIsGenerated === true,
    prompt: row.bgImageAiPrompt ?? null,
    width,
  }
  const tier = resolveImageSourceTier(cand)
  const r = evaluateImageCandidatePolicy(cand)
  if (tier === 'generated') {
    const other = r.fails.filter((f) => f !== 'L3-GEN-NO-RECORD' && f !== 'L3-GEN-FLAG-OFF')
    if (other.includes('T1-RES') || other.includes('L2-CC-BY')) return { action: 'replace_cover', fails: r.fails }
    if (r.fails.includes('L3-GEN-NO-RECORD') || r.fails.includes('L3-GEN-FLAG-OFF')) {
      return { action: 'ai_missing_record', fails: r.fails }
    }
  }
  if (r.pass) return { action: 'ok', fails: [] }
  if (r.fails.length === 1 && r.fails[0] === 'T1-RES-UNKNOWN') return { action: 'measure_width', fails: r.fails }
  return { action: 'replace_cover', fails: r.fails }
}

/** 실제로 사진을 새로 고르는 대상인지 */
export function isBackfillPhotoTarget(a: BackfillAction): boolean {
  return a === 'fill_cover' || a === 'replace_cover'
}

/** 백필 쓰기 데이터 — 허용 칸만 남김(그 밖은 버림) */
export function pickBackfillWritableData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of BACKFILL_WRITABLE_FIELDS) if (k in data) out[k] = data[k]
  return out
}

/** 공손한 속도: 요청 사이 최소 간격(ms) */
export const BACKFILL_MIN_INTERVAL_MS = 1000

/* ───────────── 공개 중 상품 교체: 50개씩 배치 + 문과장 승인 파일 (사장님 10/30 19:34) ───────────── */

export const LIVE_REPLACE_BATCH_SIZE = 50

export type BatchTarget = {
  productId: string
  slug: string | null
  title: string | null
  currentUrl: string | null
  currentWidth: number | null
}

export type BatchProposal = {
  source: 'pexels' | 'unsplash' | 'none'
  url: string | null
  width: number | null
  height: number | null
  /** Unsplash 가이드라인: 확정 시 호출할 주소(출처 기록 아님, DB 저장 안 함) */
  unsplashDownloadLocation?: string | null
  query?: string | null
}

export type BatchReviewRow = {
  productId: string
  slug: string | null
  title: string | null
  currentImageUrl: string | null
  currentWidth: number | null
  proposedImageUrl: string | null
  proposedSource: BatchProposal['source']
  proposedWidth: number | null
  proposedHeight: number | null
  unsplashDownloadLocation?: string | null
  query?: string | null
}

export type BatchReviewFile = {
  kind: 'image-live-replace-review'
  batch: number
  batchSize: number
  totalTargets: number
  generatedAt: string
  mode: 'dry-run'
  rows: BatchReviewRow[]
}

export type BatchApprovedFile = {
  kind: 'image-live-replace-approved'
  batch: number
  /** 검수 파일(review JSON) 내용의 sha256 — 검수 뒤 파일이 바뀌면 쓰지 않음 */
  reviewSha256: string
  reviewer: string
  approvedAt: string
  items: Array<{ productId: string; proposedImageUrl: string; approved: boolean }>
}

/** 고정 순서(slug→id)로 나눔 — 같은 대상이면 같은 배치 */
export function splitIntoBatches<T extends { slug: string | null; productId: string }>(
  targets: readonly T[],
  size = LIVE_REPLACE_BATCH_SIZE
): T[][] {
  const n = Math.max(1, Math.floor(size))
  const sorted = [...targets].sort(
    (a, b) => String(a.slug ?? '').localeCompare(String(b.slug ?? '')) || a.productId.localeCompare(b.productId)
  )
  const out: T[][] = []
  for (let i = 0; i < sorted.length; i += n) out.push(sorted.slice(i, i + n))
  return out
}

export function batchFileNames(batch: number): { review: string; reviewCsv: string; approved: string } {
  const b = String(batch).padStart(2, '0')
  return {
    review: `batch-${b}-review.json`,
    reviewCsv: `batch-${b}-review.csv`,
    approved: `batch-${b}-approved.json`,
  }
}

export function buildBatchReviewRow(t: BatchTarget, p: BatchProposal): BatchReviewRow {
  return {
    productId: t.productId,
    slug: t.slug,
    title: t.title,
    currentImageUrl: t.currentUrl,
    currentWidth: t.currentWidth,
    proposedImageUrl: p.url,
    proposedSource: p.source,
    proposedWidth: p.width,
    proposedHeight: p.height,
    unsplashDownloadLocation: p.source === 'unsplash' ? p.unsplashDownloadLocation ?? null : undefined,
    query: p.query ?? null,
  }
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function batchReviewCsv(rows: readonly BatchReviewRow[]): string {
  const head = [
    'productId',
    'slug',
    'title',
    'currentImageUrl',
    'currentWidth',
    'proposedImageUrl',
    'proposedSource',
    'proposedWidth',
    'proposedHeight',
  ] as const
  const lines = [head.join(',')]
  for (const r of rows) lines.push(head.map((k) => csvCell(r[k])).join(','))
  return '\uFEFF' + lines.join('\n') + '\n'
}

export type ApprovedBatchCheck =
  | { ok: true; approvedRows: BatchReviewRow[] }
  | { ok: false; reason: string }

/**
 * 승인 파일 검사 — 배치 번호·검수 파일 해시가 맞고, 승인 줄의 제안 주소가 검수 파일과 같을 때만 그 줄을 씀.
 * 승인 파일이 없거나 맞지 않으면 아무것도 쓰지 않음.
 */
export function checkApprovedBatch(
  reviewText: string,
  approved: BatchApprovedFile | null | undefined,
  batch: number
): ApprovedBatchCheck {
  if (!approved) return { ok: false, reason: 'approved_file_missing' }
  if (approved.kind !== 'image-live-replace-approved') return { ok: false, reason: 'approved_kind_mismatch' }
  if (approved.batch !== batch) return { ok: false, reason: 'batch_number_mismatch' }
  if (!String(approved.reviewer ?? '').trim()) return { ok: false, reason: 'reviewer_missing' }
  if (approved.reviewSha256 !== sha256Text(reviewText)) return { ok: false, reason: 'review_file_changed_after_approval' }
  const review = JSON.parse(reviewText) as BatchReviewFile
  if (review.batch !== batch) return { ok: false, reason: 'review_batch_mismatch' }
  const byId = new Map(review.rows.map((r) => [r.productId, r]))
  const approvedRows: BatchReviewRow[] = []
  for (const it of approved.items ?? []) {
    if (it.approved !== true) continue
    const r = byId.get(it.productId)
    if (!r || !r.proposedImageUrl || r.proposedSource === 'none') continue
    if (r.proposedImageUrl !== it.proposedImageUrl) continue
    approvedRows.push(r)
  }
  if (approvedRows.length === 0) return { ok: false, reason: 'no_approved_rows' }
  return { ok: true, approvedRows }
}
