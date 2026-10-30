/**
 * WORK-ORDER 8 3단계(준비): 기존 상품 대표 사진 보충/교체 계획 — 순수 판정(쓰기 없음).
 * 순서: Pexels → Unsplash/CC0 → AI(생성 표시). 기존 iStock(허용 목록)은 유지. 자체 사진(photo_owned)·수동(manual)은 사장님 결정 대기.
 * Pexels·Unsplash·CC0 출처 기록은 만들지도 채우지도 않음(의무 아님, 사장님 10/30).
 * REGRESSION-FREEZE[product-image-backfill-plan]: 기본 dry-run·기존 iStock 유지·이미지 칸만·출처 기록 안 만듦 — manifest
 */
import {
  IMAGE_SOURCE_TIER_ORDER,
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
}

export type BackfillAction =
  | 'fill_cover' // 대표 사진 없음 → 보충
  | 'replace_cover' // 정책 불합격(해상도·출처) → 교체
  | 'measure_width' // 가로폭 측정 실패 → 사람 확인
  | 'set_ai_label' // 생성 이미지인데 생성 표시 꺼짐 → 표시만 켬
  | 'keep_existing_istock'
  | 'owner_decision_own_photo' // photo_owned·manual
  | 'owner_decision_ai_prompt' // 생성 이미지 prompt 칸 없음
  | 'ok'

export type BackfillClassification = {
  action: BackfillAction
  fails: ImagePolicyFailCode[] | ['NO-COVER']
  note?: string
}

export function classifyBackfillRow(row: BackfillProductRow, measuredWidth: number | null = null): BackfillClassification {
  const url = (row.bgImageUrl ?? '').trim()
  if (!url) return { action: 'fill_cover', fails: ['NO-COVER'] }
  if (isExistingIstockImage(url)) return { action: 'keep_existing_istock', fails: [] }
  const src = (row.bgImageSource ?? '').trim().toLowerCase()
  if (src === 'photo_owned' || src === 'manual') return { action: 'owner_decision_own_photo', fails: [] }
  const width = row.bgImageWidth && row.bgImageWidth > 0 ? row.bgImageWidth : measuredWidth
  const cand = {
    source: row.bgImageSource,
    url,
    originalLink: row.bgImageSourceUrl ?? null,
    isGenerated: row.bgImageIsGenerated === true,
    width,
  }
  const tier = resolveImageSourceTier(cand)
  const r = evaluateImageCandidatePolicy(cand)
  if (tier === 'generated') {
    const other = r.fails.filter((f) => f !== 'L3-GEN-NO-RECORD')
    if (other.includes('T1-RES') || other.includes('L2-CC-BY')) return { action: 'replace_cover', fails: r.fails }
    if (row.bgImageIsGenerated !== true) return { action: 'set_ai_label', fails: r.fails }
    return { action: 'owner_decision_ai_prompt', fails: r.fails }
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
