/**
 * 봉투어 상품명(Product.title) 톤앤매너 SSOT — 6공급사 등록(R-5) 전용.
 *
 * 노출 SSOT(마케팅):
 * {마케팅 국가/권역} {핵심 도시 1~2(·)} {N박M일} [항공·출발·직항 등 — 원문에 있을 때만 1블록]
 *
 * 과도한 특전·키워드·미슐랭 나열로 짧게 압축하지 않는다.
 * 구분자: 가운뎃점(·), 플러스(+). () 지역 상세(필요 시). [] 항공·출발만.
 * verygoodtour 브랜드 표기는 「참좋은여행」.
 */

export const BONGTOUR_PRODUCT_TITLE_TONE_VERSION = 'v2-2026-06-06'

/** 선호 최소 길이(가이드). 검증 hard fail 아님. */
export const BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN = 16
/** 선호 최대 길이(가이드). 검증 hard fail 아님. */
export const BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX = 56
/** 저장·노출 상한(잘림 방지) */
export const BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX = 90
/** 비정상적으로 짧은 출력 거부 */
export const BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MIN = 8

export const BONGTOUR_PRODUCT_TITLE_REQUIRED_FIELDS = ['country_or_region', 'day_count'] as const
export const BONGTOUR_PRODUCT_TITLE_OPTIONAL_FIELDS = [
  'cities',
  'airline',
  'direct_or_connecting',
  'guide_escort',
  'departure_city',
  'selling_keywords',
  'upgrade_only',
] as const

export const BONGTOUR_PRODUCT_TITLE_TEMPLATE =
  '{마케팅 국가/권역} {도시1·도시2} {N박M일} [항공·출발·직항 — 선택]'

/** 공급사 등록 LLM(JSON title) — 원문 보존. 노출명 다듬기는 bongtour-product-title 단계. */
export const REGISTER_LLM_PRODUCT_TITLE_EXTRACT_LINE =
  '- **title(JSON)**: 공급사 리스트·상단에 보이는 상품명을 **붙여넣기 원문과 동일하게** 출력(선행 [배지] 제거·공백 정리만 서버 후처리). 의역·요약·짧게 줄이기·해시태그 삭제 금지. **duration**은 본문 N박M일(예: 3박 4일)을 그대로.'

/** 금칙(부분 일치·대소문자 무시). NO옵션·노옵션 등 공급사 실제 카피는 예시에 포함되어 금칙에서 제외. */
export const BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS: readonly string[] = [
  '엄선',
  '프리미엄',
  '단독',
  'THE NEW',
  'THE NEW PREMIUM',
  '더할 나위 없는',
  '천천히 알차게',
  '★',
  '※',
  '◎',
  '◆',
  '▶',
  '베리굿투어',
  'Very Good Tour',
]

export type BongtourProductTitleValidationResult = {
  ok: boolean
  issues: string[]
  charLength: number
  inPreferredLengthBand: boolean
  hasDayCountToken: boolean
  hasHangul: boolean
}

function normalizeForScan(s: string): string {
  return s.trim().toLowerCase()
}

/** 일수 토큰: `10일`, `3박 4일` 내 `4일`, `9일` 등 (JS `\\b`는 한글 경계에 부적합해 숫자-일 패턴만 본다) */
export function titleHasDayCountToken(title: string): boolean {
  const t = title.trim()
  if (/(?<!\d)\d+\s*일(?!\d)/.test(t)) return true
  if (/\d+\s*박\s*\d+\s*일/.test(t)) return true
  return false
}

export function sanitizeBongtourProductTitle(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').trim()
  for (const ch of ['★', '※', '◎', '◆', '▶']) {
    s = s.split(ch).join('')
  }
  s = s.replace(/\s+/g, ' ').trim()
  for (const tok of BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS) {
    if (!tok.trim()) continue
    const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    s = s.replace(re, '')
  }
  s = s.replace(/\s*·\s*/g, ' · ').replace(/\s*\+\s*/g, '+').replace(/\s{2,}/g, ' ').trim()
  return s.slice(0, BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX)
}

export function validateBongtourProductTitle(title: string): BongtourProductTitleValidationResult {
  const charLength = [...title].length
  const hasHangul = /[가-힣]/.test(title)
  const hasDayCountToken = titleHasDayCountToken(title)
  const inPreferredLengthBand =
    charLength >= BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN &&
    charLength <= BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX
  const issues: string[] = []

  if (charLength < BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MIN) {
    issues.push(`길이가 너무 짧습니다(${charLength}자, 하한 ${BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MIN}자).`)
  }
  if (charLength > BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX) {
    issues.push(`길이가 상한을 초과했습니다(${charLength}자, 상한 ${BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX}자).`)
  }
  if (!hasDayCountToken) {
    issues.push('일수 표기(예: N일, N박M일)가 없습니다.')
  }
  if (!hasHangul) {
    issues.push('한글 지역·상품 맥락이 거의 없습니다.')
  }
  if (!inPreferredLengthBand && charLength >= BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MIN) {
    issues.push(
      `선호 길이 밖입니다(${charLength}자, 권장 ${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN}~${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX}자).`
    )
  }

  const lower = normalizeForScan(title)
  for (const tok of BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS) {
    if (tok && lower.includes(tok.toLowerCase())) {
      issues.push(`금칙 표현 포함: ${tok}`)
    }
  }

  const hardFail =
    charLength < BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MIN ||
    charLength > BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX ||
    !hasDayCountToken ||
    !hasHangul ||
    issues.some((i) => i.startsWith('금칙 표현'))

  return {
    ok: !hardFail,
    issues,
    charLength,
    inPreferredLengthBand,
    hasDayCountToken,
    hasHangul,
  }
}

export type BongtourProductTitleValidationSnapshotV1 = {
  ok: boolean
  issues: string[]
  charLength: number
  inPreferredLengthBand: boolean
  hasDayCountToken: boolean
  hasHangul: boolean
}

export function validationToSnapshot(v: BongtourProductTitleValidationResult): BongtourProductTitleValidationSnapshotV1 {
  return {
    ok: v.ok,
    issues: [...v.issues],
    charLength: v.charLength,
    inPreferredLengthBand: v.inPreferredLengthBand,
    hasDayCountToken: v.hasDayCountToken,
    hasHangul: v.hasHangul,
  }
}
