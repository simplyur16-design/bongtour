/**
 * 상품 이미지 자동 등록 출처 정책 SSOT (WORK-ORDER 8, 사장님 2026-10-27 22:40 지시 + IMAGE-REVIEW-RULES v1).
 * 순서: Pexels → Unsplash / CC0 → (최후) 생성 이미지(내부 '생성' 표시 + prompt 기록, 공개 시 AI 안내).
 * 금지: iStock, CC BY 계열(저작자 표시 의무 라이선스), 출처 불명. 크레딧은 의무일 때만 아주 작은 글씨.
 * 새 공개 이미지는 문과장 검수 통과 = 승인 전까지 공개 반영 금지(reviewApproved=false → 'awaiting_review').
 * REGRESSION-FREEZE[product-image-source-policy]: 출처 순서·iStock/CC BY 금지·생성 표시 — manifest
 */
import { inferSourceKeyFromImageUrl } from '@/lib/product-image-source-attribution'

export type ImageSourceTier = 'pexels' | 'unsplash' | 'cc0' | 'generated'

/** 자동 선택 우선순위 (낮을수록 먼저) */
export const IMAGE_SOURCE_TIER_ORDER: readonly ImageSourceTier[] = ['pexels', 'unsplash', 'cc0', 'generated'] as const

export type ImageCandidate = {
  source: string | null | undefined
  url?: string | null
  externalId?: string | null
  originalLink?: string | null
  photographer?: string | null
  license?: string | null
  isGenerated?: boolean | null
  prompt?: string | null
  width?: number | null
  height?: number | null
}

export type ImagePolicyFailCode =
  | 'L1-NO-RECORD'
  | 'L2-OTHER-SOURCE'
  | 'L2-ISTOCK'
  | 'L2-CC-BY'
  | 'L3-GEN-NO-RECORD'
  | 'T1-RES'
  | 'T4-LINK'

export type ImagePolicyResult = {
  tier: ImageSourceTier | null
  pass: boolean
  fails: ImagePolicyFailCode[]
  /** 공개 화면 크레딧: 라이선스상 의무일 때만 true (Pexels·Unsplash·CC0는 의무 아님) */
  creditRequired: boolean
  /** 생성 이미지는 공개 시 AI 안내 표시 */
  aiLabelRequired: boolean
}

const MIN_WIDTH = 1200

function lower(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

/** CC BY / BY-SA / BY-NC 등 저작자 표시 의무 라이선스 (CC0·Public Domain은 제외) */
export function isAttributionRequiredLicense(license: string | null | undefined): boolean {
  const l = lower(license).replace(/[\s_]+/g, '-')
  if (!l) return false
  if (/(^|-)cc0($|-)|public-?domain|pdm/.test(l)) return false
  return /cc-?by|creative-?commons-?attribution|attribution/.test(l)
}

export function resolveImageSourceTier(c: ImageCandidate): ImageSourceTier | 'istock' | null {
  const s = lower(c.source)
  const link = lower(c.originalLink)
  const fromUrl = inferSourceKeyFromImageUrl(c.url ?? null)
  if (s === 'istock' || /istockphoto\.com|gettyimages/.test(link) || fromUrl === 'istock') return 'istock'
  if (c.isGenerated || /^gemini|^generated$|^gen$/.test(s) || (fromUrl ?? '').startsWith('gemini')) return 'generated'
  if (s === 'pexels' || /pexels\.com/.test(link) || fromUrl === 'pexels') return 'pexels'
  if (s === 'unsplash' || /unsplash\.com/.test(link)) return 'unsplash'
  if (s === 'cc0' || /(^|[\s-])cc0($|[\s-])|public\s*domain/.test(lower(c.license))) return 'cc0'
  return null
}

/** 1단계 자동 점검(L1~L3, T1, T4 기록 여부) — 상품 적합성(M)·생성 오해(G)는 문과장 판정 */
export function evaluateImageCandidatePolicy(c: ImageCandidate): ImagePolicyResult {
  const fails: ImagePolicyFailCode[] = []
  const tier = resolveImageSourceTier(c)
  if (tier === 'istock') fails.push('L2-ISTOCK')
  else if (tier === null) fails.push('L2-OTHER-SOURCE')
  if (isAttributionRequiredLicense(c.license)) fails.push('L2-CC-BY')
  if (tier === 'pexels' || tier === 'unsplash') {
    if (!String(c.externalId ?? '').trim() || !String(c.originalLink ?? '').trim() || !String(c.photographer ?? '').trim()) {
      fails.push('L1-NO-RECORD')
    }
  }
  if (tier === 'cc0' && !String(c.originalLink ?? '').trim()) fails.push('L1-NO-RECORD')
  if (tier === 'generated' && !String(c.prompt ?? '').trim()) fails.push('L3-GEN-NO-RECORD')
  if (typeof c.width === 'number' && c.width > 0 && c.width < MIN_WIDTH) fails.push('T1-RES')
  if (!String(c.url ?? '').trim()) fails.push('T4-LINK')
  const okTier = tier === 'pexels' || tier === 'unsplash' || tier === 'cc0' || tier === 'generated'
  return {
    tier: okTier ? tier : null,
    pass: fails.length === 0,
    fails,
    creditRequired: false,
    aiLabelRequired: tier === 'generated',
  }
}

/** 후보 정렬: 출처 순서 → 정책 통과 우선. 생성은 실사 후보가 모두 탈락했을 때만 맨 뒤. */
export function orderImageCandidatesByPolicy<T extends ImageCandidate>(cands: readonly T[]): T[] {
  const rank = (c: T) => {
    const r = evaluateImageCandidatePolicy(c)
    const t = r.tier ? IMAGE_SOURCE_TIER_ORDER.indexOf(r.tier) : 99
    return (r.pass ? 0 : 1000) + t
  }
  return [...cands].map((c, i) => ({ c, i, k: rank(c) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.c)
}

/** 최대 5회 후보 시도 후 모두 탈락이면 '이미지 대기' — 임시·엉뚱한 사진으로 채우지 않음 */
export const IMAGE_CANDIDATE_MAX_ATTEMPTS = 5

export type ImageAutoRegisterState = 'awaiting_review' | 'approved' | 'image_waiting'

export function resolveImageAutoRegisterState(params: {
  attempts: number
  anyPolicyPass: boolean
  reviewApproved: boolean
}): ImageAutoRegisterState {
  if (params.reviewApproved) return 'approved'
  if (!params.anyPolicyPass && params.attempts >= IMAGE_CANDIDATE_MAX_ATTEMPTS) return 'image_waiting'
  return 'awaiting_review'
}
