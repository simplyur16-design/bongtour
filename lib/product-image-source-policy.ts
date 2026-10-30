/**
 * 상품 이미지 자동 등록 출처 정책 SSOT (WORK-ORDER 8, 사장님 2026-10-27 22:40 지시 + IMAGE-REVIEW-RULES v1).
 * 순서: Pexels → Unsplash / CC0 → (최후) 생성 이미지(내부 '생성' 표시 + prompt 기록, 공개 시 AI 안내).
 * 금지: iStock, CC BY 계열(저작자 표시 의무 라이선스), 출처 불명. 크레딧은 의무일 때만 아주 작은 글씨.
 * 새 공개 이미지는 문과장 검수 통과 = 승인 전까지 공개 반영 금지(reviewApproved=false → 'awaiting_review').
 * REGRESSION-FREEZE[product-image-source-policy]: 출처 순서·iStock/CC BY 금지·생성 표시 — manifest
 *
 * 2026-10-30 사장님 지시("픽셀은 출처기록안해도 되는것으로 알고있다" / "출처를 따로쓰지 않아도 되는 사진은 괜찮다"):
 * - Pexels·Unsplash·CC0는 출처 표시 의무 없음 → 출처 기록(ID·원본링크·작가) 빠져도 불합격 아님. 크레딧 기록을 새로 만들거나 채우지 않는다.
 * - "attribution not required" 같은 문구는 CC BY로 읽지 않는다.
 * - 이미 bongtour.com에 붙어 있는 iStock(사장님 구매분)은 허용 목록(EXISTING_ISTOCK_IMAGE_KEYS)으로만 예외 통과. 새 iStock·CC BY는 계속 금지.
 * - 가로폭을 모르면 통과가 아니라 'T1-RES-UNKNOWN'(확인 필요).
 * REGRESSION-FREEZE[product-image-source-policy-1030]: 출처 기록 불필요·기존 iStock 허용 목록·가로폭 미상=확인 필요 — manifest
 *
 * 2026-10-30 19:34 KST 사장님 지시("자체 사진 7장 허용해" / "AI 표시 칸 추가해" / pkg-yb-0004 940px iStock 유지):
 * - 봉투어 자체 사진 7장은 허용 목록(OWNED_BONGTOUR_IMAGE_KEYS)으로 'owned' 출처 통과(크레딧 불필요). 새 자체/수동 업로드는 목록 추가 전까지 출처 밖.
 * - 사장님이 유지하기로 한 사진(기존 iStock·자체 사진 7장)은 가로폭 검사 예외(ownerKeptLowRes 로만 표시, 교체 대상 아님).
 * - 생성 이미지는 생성 표시(bgImageIsGenerated=true) + prompt 기록(bgImageAiPrompt) 둘 다 있어야 통과.
 * REGRESSION-FREEZE[product-image-stage4-1030]: 자체 사진 7장 허용 목록·사장님 유지 사진 가로폭 예외·생성=표시+prompt — manifest
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
  | 'L2-OTHER-SOURCE'
  | 'L2-ISTOCK'
  | 'L2-CC-BY'
  | 'L3-GEN-NO-RECORD'
  /** 생성 이미지인데 생성 표시(bgImageIsGenerated)가 꺼짐 */
  | 'L3-GEN-FLAG-OFF'
  | 'T1-RES'
  /** 가로폭을 모름 → 통과 아님, 측정(헤더/메타데이터) 후 재판정 */
  | 'T1-RES-UNKNOWN'
  | 'T4-LINK'

export type ImagePolicyResult = {
  /** 'istock_existing' = 허용 목록에 있는 기존 iStock(유지만, 새 후보로 고르지 않음) */
  tier: ImageSourceTier | 'istock_existing' | 'owned' | null
  pass: boolean
  /** 사장님 유지 사진(기존 iStock·자체 사진)이 1200px 미만 — 예외 통과, 정보 표시만 */
  ownerKeptLowRes: boolean
  fails: ImagePolicyFailCode[]
  /** 공개 화면 크레딧: 라이선스상 의무일 때만 true (Pexels·Unsplash·CC0는 의무 아님) */
  creditRequired: boolean
  /** 생성 이미지는 공개 시 AI 안내 표시 */
  aiLabelRequired: boolean
}

export const IMAGE_MIN_WIDTH = 1200
const MIN_WIDTH = IMAGE_MIN_WIDTH

/**
 * 기존 iStock 허용 목록 — 2026-10-30 KST 운영 DB(읽기 전용)에서 bgImageSource='istock'이고 대표 사진으로 이미 붙어 있던 10개 상품의 저장 파일 키.
 * 날짜 기준 대신 파일 키 목록을 쓰는 이유: DB에 '사진이 붙은 날짜' 칸이 없어 날짜로는 기존/신규를 가를 수 없고,
 * 파일 키는 새로 올린 iStock이 저절로 끼어들 수 없다. 목록에 추가하려면 사장님 확인 후 코드 변경으로만.
 */
export const EXISTING_ISTOCK_IMAGE_KEYS: readonly string[] = [
  'places/unknown/unknown-pexels-30933135.webp', // pkg-yb-0004 (DB 출처 istock, 파일명은 pexels)
  'photo-pool/primary_hero_manual-upload__2b934e365a608dd9.webp', // fit-mt-0008
  'photo-pool/primary_hero_manual-upload__1c421c38e2d25e4f.webp', // pkg-yb-0006
  'photo-pool/primary_hero_manual-upload__9c60bfcece736aeb.webp', // fit-mt-0004
  'photo-pool/primary_hero_manual-upload__49f44f6216a8a9fd.webp', // pkg-yb-0012
  'photo-pool/primary_hero_manual-upload__f2744a9e21d4e380.webp', // pkg-yb-0005
  'photo-pool/primary_hero_manual-upload__fd98f0e963cdc4ff.webp', // pkg-yb-0013
  'photo-pool/primary_hero_manual-upload__1b19b51bdbc61001.webp', // pkg-yb-0007
  'photo-pool/primary_hero_manual-upload__aa70ae450fc1ba0a.webp', // pkg-mt-0004
  'photo-pool/primary_hero_manual-upload__1f51d6ca2f3cf344.webp', // fit-mt-0018
] as const

/**
 * 봉투어 자체 사진 허용 목록 — 2026-10-30 KST 운영 DB(읽기 전용, 18:39 스냅샷)에서 bgImageSource='photo_owned'(6)·'manual'(1)로
 * 대표 사진에 붙어 있던 7개 상품의 저장 파일 키(디코딩된 경로). 사장님 19:34 "자체 사진 7장 허용해".
 * 목록에 추가하려면 사장님 확인 후 코드 변경으로만.
 */
export const OWNED_BONGTOUR_IMAGE_KEYS: readonly string[] = [
  'photo-pool/남부_레이카비크_블루라군_primary_hero_manual-upload__mr3ak5q0.webp', // pkg-mt-0161
  'photo-pool/밍글링_투어_Light_밍글링_타임_외_primary_hero_manual-upload__mrg383yd.webp', // pkg-hn-0046
  'photo-pool/밍글링_투어_Light_밍글링_타임_외_primary_hero_manual-upload__mrg2r3sf.webp', // pkg-hn-0045
  'photo-pool/나트랑_해적_호핑_DAY2_manual-upload__ms40u251.webp', // pkg-hn-0073 (manual)
  'photo-pool/미지정_primary_hero_manual-upload__mrkdlqza.webp', // pkg-yb-0054
  'photo-pool/오키나와_미야코지마_외_9도시_primary_hero_manual-upload__mr7sw0di.webp', // pkg-mt-0171 (640px)
  'photo-pool/미야코지마_토오리이케_외_7도시_primary_hero_manual-upload__mr7uegf6.webp', // fit-mt-0050 (640px)
] as const

/** 이미지 URL → 저장 파일 키(버킷 뒤 경로, 쿼리 제거, %인코딩 풀기) */
export function imageStorageKeyFromUrl(url: string | null | undefined): string {
  const raw = String(url ?? '').trim().split('?')[0]?.split('#')[0] ?? ''
  if (!raw) return ''
  const m = raw.match(/^https?:\/\/[^/]+\/(?:bongtour\/)?(.+)$/i)
  const key = (m ? m[1] : raw).replace(/^\/+/, '')
  try {
    return decodeURIComponent(key).normalize('NFC')
  } catch {
    return key
  }
}

export function isOwnedBongtourImage(url: string | null | undefined): boolean {
  const key = imageStorageKeyFromUrl(url)
  return !!key && OWNED_BONGTOUR_IMAGE_KEYS.some((k) => k.normalize('NFC') === key)
}

export function isExistingIstockImage(url: string | null | undefined): boolean {
  const key = imageStorageKeyFromUrl(url)
  return !!key && EXISTING_ISTOCK_IMAGE_KEYS.includes(key)
}

function lower(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

/** CC BY / BY-SA / BY-NC 등 저작자 표시 의무 라이선스 (CC0·Public Domain은 제외) */
export function isAttributionRequiredLicense(license: string | null | undefined): boolean {
  const l = lower(license).replace(/[\s_]+/g, '-')
  if (!l) return false
  if (/(^|-)cc0($|-)|public-?domain|pdm/.test(l)) return false
  // Pexels·Unsplash 라이선스, "attribution not required"/"no attribution" 류는 표시 의무 없음
  if (/(^|-)(pexels|unsplash)(-license)?($|-)/.test(l)) return false
  if (
    /attribution-(is-)?not-(required|necessary|needed)|no-attribution|without-attribution|attribution-optional|not-required-attribution|attribution-free/.test(
      l
    )
  )
    return false
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
  const istockExisting = tier === 'istock' && isExistingIstockImage(c.url)
  const owned = !istockExisting && isOwnedBongtourImage(c.url)
  const ownerKept = istockExisting || owned
  if (tier === 'istock' && !istockExisting) fails.push('L2-ISTOCK')
  else if (tier === null && !owned) fails.push('L2-OTHER-SOURCE')
  if (!ownerKept && isAttributionRequiredLicense(c.license)) fails.push('L2-CC-BY')
  // Pexels·Unsplash·CC0: 출처 기록(ID·원본링크·작가) 없어도 불합격 아님 (사장님 2026-10-30)
  // 생성 이미지: 생성 표시 + prompt 기록 둘 다 있어야 통과 (사장님 2026-10-30 19:34 "AI 표시 칸 추가해")
  if (!owned && tier === 'generated') {
    if (!String(c.prompt ?? '').trim()) fails.push('L3-GEN-NO-RECORD')
    if (c.isGenerated !== true) fails.push('L3-GEN-FLAG-OFF')
  }
  let ownerKeptLowRes = false
  if (typeof c.width === 'number' && c.width > 0) {
    if (c.width < MIN_WIDTH) {
      if (ownerKept) ownerKeptLowRes = true // 사장님 유지 결정(pkg-yb-0004 940px 등) — 교체 대상 아님
      else fails.push('T1-RES')
    }
  } else if (!ownerKept) {
    fails.push('T1-RES-UNKNOWN')
  }
  if (!String(c.url ?? '').trim()) fails.push('T4-LINK')
  const okTier = tier === 'pexels' || tier === 'unsplash' || tier === 'cc0' || tier === 'generated'
  return {
    tier: istockExisting ? 'istock_existing' : owned ? 'owned' : okTier ? (tier as ImageSourceTier) : null,
    pass: fails.length === 0,
    ownerKeptLowRes,
    fails,
    creditRequired: false,
    aiLabelRequired: !owned && tier === 'generated',
  }
}

/** 후보 정렬: 출처 순서 → 정책 통과 우선. 생성은 실사 후보가 모두 탈락했을 때만 맨 뒤. */
export function orderImageCandidatesByPolicy<T extends ImageCandidate>(cands: readonly T[]): T[] {
  const rank = (c: T) => {
    const r = evaluateImageCandidatePolicy(c)
    const t = r.tier && r.tier !== 'istock_existing' && r.tier !== 'owned' ? IMAGE_SOURCE_TIER_ORDER.indexOf(r.tier) : 99
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
