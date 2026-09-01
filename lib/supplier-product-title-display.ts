/**
 * 방안 B — 공급사 원문 기반 노출 상품명(Product.title) SSOT.
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 홈 미사용 — manifest
 * 마케팅 축약·R-5 LLM 자동 저장 금지 — Product.title 노출명 SSOT.
 *
 * - originalTitle: 붙여넣기·파싱 원문(최소 trim)
 * - display title: UI 노이즈·무쇼핑/무옵션/직항 배지만 제거, 나머지 원문 유지
 */
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import { normalizeNaeiltourRegisterListingTitle } from '@/lib/naeiltour-register-product-title'

export const SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION = 'plan-b-v3-2026-09-01'

/** Product.title·메타 상한 — bongtour-product-title-tone HARD_MAX 와 동일 */
export const SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX = 90

const UI_NOISE_CHARS = ['★', '※', '◎', '◆', '▶'] as const

/** 한글 지명(이태리·스페인·괌 츠바키 앞 토큰)은 2글자도 상품명이다. ASCII만 4자. */
// REGRESSION-FREEZE[supplier-product-title-plan-b]: 한글 2자+ 제목 허용 — manifest
function isSupplierDisplayTitleLongEnough(t: string): boolean {
  if (t.length >= 4) return true
  return t.length >= 2 && /[가-힣]/.test(t)
}

function uniqueTitleCandidates(...parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function resolveSupplierVerbatimOriginalTitle(args: {
  parsedSupplierTitle: string
  supplierListingTitleRaw?: string | null
  brandKey?: string
}): string {
  const candidates = uniqueTitleCandidates(
    args.supplierListingTitleRaw,
    args.parsedSupplierTitle,
  )
  for (const c of candidates) {
    if (isSupplierDisplayTitleLongEnough(c) && !isSupplierListingTitleUnacceptable(c, args.brandKey)) return c
  }
  return '미입력'
}

/** 공백·NBSP·UI 장식(★※▶)만 정리 */
export function stripSupplierTitleUiNoise(s: string): string {
  let t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  t = t.replace(/[\u00a0\u3000]+/g, ' ')
  for (const ch of UI_NOISE_CHARS) {
    t = t.split(ch).join('')
  }
  return t.replace(/\s+/g, ' ').trim()
}

/** `[출발확정]`·`[오전출발]`·`[매진임박]`·`[best]` 등 마케팅/상태 대괄호 — [지역]·[항공사]는 제외 */
const SUPPLIER_TITLE_PROMO_BADGE_INNER =
  /(?:출발\s*확정|매진\s*임박|마감\s*임박|긴급\s*모객|오전\s*출발|저녁\s*출발|오후\s*출발|선착\s*순|스테디\s*셀러|베스트\s*셀러|홈\s*쇼핑|품격|유류\s*할증|연휴\s*좌석|추석\s*연휴|설\s*연휴|휴양형|판매\s*(?:마감|완료|종료)|예약\s*마감|잔여\s*좌석|잔여\s*[0-9①-⑳]+\s*석|잔여석|남은\s*좌석|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|\bHIT\b|\bBEST\b|\bNEW\b|\bHOT\b|\bTKT\b|\bONLY\b)/i

/**
 * 홈·등록대기 상품명에 쓰지 않는 판매상태·잔여석·캐빈·시즌 마케팅.
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 — manifest
 */
export const SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE =
  /판매\s*(?:마감|완료|종료)|예약\s*마감|마감\s*임박|잔여\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|잔여\s*[0-9①-⑳]+\s*석|잔여석(?:\s*[0-9①-⑳]+\s*석)?|남은\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|프리미엄\s*(?:이코노미(?:\s*클래스)?|이코노미)|비즈니스\s*석|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|왜\s*이제\s*왔을까|SNS\s*맛집/gi

const CABIN_KEEP_INNER_RE =
  /^비즈니스(?:\s*[\/·．.／]+\s*클래스?|\s*클래스|\s*[\/·．.／]+)?$/i

function unwrapTitleBadge(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^[\[【#]+/, '')
    .replace(/[\]】]+$/, '')
    .trim()
}

/** 제목에는 `[비즈니스]`로 남겨도 됨. 지역(목적지)으로는 쓰지 않음. */
export function isSupplierTitleBusinessCabinKeep(raw: string): boolean {
  return CABIN_KEEP_INNER_RE.test(unwrapTitleBadge(raw))
}

/** 목적지·목록 지역 컬럼 — 판매 뱃지 + 캐빈 `[비즈니스]` 모두 지명 아님 */
export function isSupplierTitleNotDestinationToken(raw: string): boolean {
  return isPromoOnlyBadgeText(raw) || isSupplierTitleBusinessCabinKeep(raw)
}

export function hasSupplierHomepageForbiddenTitlePhrase(raw: string): boolean {
  SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE.lastIndex = 0
  return SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE.test(String(raw ?? ''))
}

function stripHomepageForbiddenTitlePhrases(s: string): string {
  return String(s ?? '')
    .replace(new RegExp(SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE.source, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSupplierTitlePromoBadgeText(raw: string): boolean {
  return isPromoOnlyBadgeText(raw)
}

function isPromoOnlyBadgeText(raw: string): boolean {
  let spaced = unwrapTitleBadge(raw)
  if (!spaced) return true
  if (isSupplierTitleBusinessCabinKeep(spaced)) return false
  let compact = spaced.replace(/\s/g, '')
  compact = compact.replace(/^노팁/, '')
  if (!compact) return true
  if (/^(?:무(?:쇼핑|옵션)|노(?:쇼핑|옵션|팁)|직항|출발확정|매진임박|긴급모객|판매마감|판매완료|잔여좌석|잔여석|단풍시즌|벚꽃시즌|눈꽃시즌|클래스|nooption|noshopping|best|hit|new|hot|tkt|only)$/i.test(compact)) {
    return true
  }
  if (/^tkt\s*[\/·．.／]\s*only$/i.test(spaced)) return true
  if (/^[\/·．.／]+클래스$/i.test(spaced)) return true
  if (SUPPLIER_TITLE_PROMO_BADGE_INNER.test(spaced)) return true
  if (/^(?:오전|오후|저녁)출발/i.test(compact)) return true
  if (!stripHomepageForbiddenTitlePhrases(spaced).replace(/[\[\]【】#/·,\s-]+/g, '')) return true
  return false
}

/**
 * 등록 parse·preview 상품명 — UI 노이즈 + [출발확정] 등 마케팅 []·# 제거.
 * [다낭]·[동유럽]·#바나힐 등 지역·일반 해시는 유지.
 */
export function normalizeSupplierRegisterListingTitle(s: string): string {
  return stripSupplierTitlePromoBadges(stripSupplierTitleUiNoise(s))
}

function foldBusinessCabinKeepBrackets(s: string): string {
  let t = String(s ?? '')
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, (m, inner: string) =>
    isSupplierTitleBusinessCabinKeep(inner) ? '[비즈니스]' : m,
  )
  t = t.replace(/【\s*([^】]*?)\s*】/g, (m, inner: string) =>
    isSupplierTitleBusinessCabinKeep(inner) ? '[비즈니스]' : m,
  )
  t = t.replace(/비즈니스\s*[\/·．.／]+\s*클래스/gi, '[비즈니스]')
  t = t.replace(/비즈니스\s+클래스/gi, '[비즈니스]')
  return t
}

/** 무쇼핑·무옵션·직항 등 마케팅 배지만 제거 — [지역]·[항공사]·일반 #태그는 유지. `[비즈니스]`는 유지. */
export function stripSupplierTitlePromoBadges(s: string): string {
  let t = foldBusinessCabinKeepBrackets(s)
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, (m, inner: string) => (isPromoOnlyBadgeText(inner) ? ' ' : m))
  t = t.replace(/【\s*([^】]*?)\s*】/g, (m, inner: string) => (isPromoOnlyBadgeText(inner) ? ' ' : m))
  t = t.replace(/#[^\s#]+/g, (m) => (isPromoOnlyBadgeText(m.slice(1)) ? ' ' : m))
  t = stripHomepageForbiddenTitlePhrases(t)
  t = t.replace(/\[\s*[\/·．.／]*\s*클래스\s*\]/gi, ' ')
  t = t.replace(/\[\s*\]/g, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

function normalizeSupplierTitleForDisplay(s: string, brandKey?: string): string {
  let t = stripSupplierTitlePromoBadges(stripSupplierTitleUiNoise(s))
  if (brandKey === 'naeiltour') t = normalizeNaeiltourRegisterListingTitle(t)
  return t
}

export type SupplierProductDisplayTitleInput = {
  verbatimOriginal: string
  parsedSupplierTitle?: string
  brandKey?: string
}

/** Plan B 노출명 — 원문 기반 경량 정리. 출발일 구간·박일만 줄은 거부 */
export function buildSupplierProductDisplayTitle(input: SupplierProductDisplayTitleInput): string {
  const candidates = uniqueTitleCandidates(
    normalizeSupplierTitleForDisplay(input.verbatimOriginal, input.brandKey),
    normalizeSupplierTitleForDisplay(input.parsedSupplierTitle ?? '', input.brandKey),
  ).filter((t) => isSupplierDisplayTitleLongEnough(t))

  for (const c of candidates) {
    const clipped = c.slice(0, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX)
    if (isSupplierListingTitleUnacceptable(clipped, input.brandKey)) continue
    return clipped
  }
  return '미입력'
}
