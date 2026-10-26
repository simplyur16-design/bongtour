/**
 * 방안 B — 공급사 원문 기반 노출 상품명(Product.title) SSOT.
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 홈 미사용 — manifest
 * 마케팅 축약·R-5 LLM 자동 저장 금지 — Product.title 노출명 SSOT.
 *
 * plan-b-v5: 상태/프로모/홈쇼핑/날짜·장식 래퍼만 제거. 공급사 어순·표현 유지.
 * 노쇼핑·노옵션·항공·출발도시·[2030전용]·[비즈니스] 등은 유지.
 *
 * - originalTitle: 붙여넣기·파싱 원문(최소 trim)
 * - display title: UI 노이즈·판매 문구만 제거, 나머지 원문 유지
 */
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import { normalizeNaeiltourRegisterListingTitle } from '@/lib/naeiltour-register-product-title'
import {
  collapseAdjacentDuplicateTitlePhrases,
  decodePublicHtmlEntities,
} from '@/lib/decode-public-html-entities'

export const SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION = 'plan-b-v5-2026-10-26'

/** Product.title·메타 상한 — bongtour-product-title-tone HARD_MAX 와 동일 */
export const SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX = 90

// REGRESSION-FREEZE[register-pre-photo-heal-pending-fail2]: ●○ dest·제목 장식 제거 — manifest
// REGRESSION-FREEZE[supplier-title-no-sale-status-season]: ■◀ 장식·가격 선두 제거 — manifest
const UI_NOISE_CHARS = ['★', '※', '◎', '◆', '▶', '◀', '◁', '●', '○', '■', '◐', '◑'] as const

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

/** 유류·할인 관련 (특급/특식/특전은 건드리지 않음 — '특가'만) */
const FUEL_SURCHARGE_RE =
  /(?:NO\s*)?유류\s*(?:세|할증(?:료)?)?(?:\s*(?:고정|인상|인하|ZERO|제로|0|차액!?))?(?:\s*NO)?|유류\s*(?:세\s*)?(?:인상|고정)\s*NO/gi

const TEUKGA_RE = /(?:없는\s+)?(?:추석|취항|기획|한정|초|연휴|황금\s*연휴)?\s*특가|(?:추석|취항|기획|한정|초)특가/gi

const STATUS_WORD_RE =
  /출발\s*확정|출발\s*임박|마감\s*임박|매진\s*임박|대기\s*예약|예약\s*마감|판매\s*(?:마감|완료|종료)|예약\s*가능|출발\s*가능|100\s*%\s*출발|잔여\s*좌석|잔여석|남은\s*좌석|좌석\s*(?:마감|부족)|긴급\s*모객|집중\s*모객/gi

const CHANNEL_OR_COMPETITOR_RE =
  /하나\s*LIVE|CJ\s*온\s*스타일|SK\s*스토아|SK\s*스토어|롯데\s*홈\s*쇼핑|GS\s*샵|현대\s*홈\s*쇼핑|NS\s*홈\s*쇼핑|공영\s*쇼핑|홈앤\s*쇼핑|롯데관광\s*'?\s*단독/gi

const NAMED_PROMO_RE =
  /얼리\s*마켓|여행\s*핫딜|옐로\s*팡딜|특별\s*기획|트래블\s*페스타|스테디\s*셀러|베스트\s*셀러|홈\s*쇼핑|품격|황금\s*연휴(?:특선|기간)?|선착\s*순(?:\s*\d+\s*(?:석|명))?/gi

/**
 * ★…★ / ▶…◀ / ◐…◑ 등 쌍 래퍼를 먼저 풀어 본문을 남긴다 (★제거만 하면 '/대형기…' 잔재).
 * ~웹예약N만원할인~ 래퍼는 통째로 제거.
 */
function unwrapDecorativeSymbolPairs(s: string): string {
  let t = String(s ?? '')
  const pairRules: Array<[RegExp, string]> = [
    [/★([^★\n]{0,80})★/g, ' $1 '],
    [/▶([^◀\n]{0,80})◀/g, ' $1 '],
    [/◐([^◑\n]{0,80})◑/g, ' $1 '],
    [/●([^●\n]{0,80})●/g, ' $1 '],
    [/■\s*([^■\n]{0,48})\s*■/g, ' $1 '],
    [/◆([^◆\n]{0,48})◆/g, ' $1 '],
  ]
  for (const [re, rep] of pairRules) {
    t = t.replace(re, rep)
  }
  t = t.replace(/~[^~\n]{0,48}할인~/g, ' ')
  t = t.replace(/웹\s*예약\s*\d+\s*만\s*원\s*할인/gi, ' ')
  return t
}

function tidyTitleSeparators(s: string): string {
  let t = String(s ?? '')
  // 빈 괄호
  t = t.replace(/\[\s*\]/g, ' ')
  t = t.replace(/\(\s*\)/g, ' ')
  t = t.replace(/【\s*】/g, ' ')
  // 괄호 안 선두/후미 구분자
  t = t.replace(/\[\s*[\/_+,\s]+/g, '[')
  t = t.replace(/[\/_+,\s]+\s*\]/g, ']')
  t = t.replace(/【\s*[\/_+,\s]+/g, '【')
  t = t.replace(/[\/_+,\s]+\s*】/g, '】')
  // 제목 선두/후미 구분자
  t = t.replace(/^[\/_+,.\s]+/g, '')
  t = t.replace(/[\/_+,\s]+$/g, '')
  // ][ · ]단어 → 간격
  t = t.replace(/\]\s*\[/g, '] [')
  t = t.replace(/】\s*【/g, '】 【')
  t = t.replace(/([\]】)])(?=[A-Za-z가-힣0-9#『「])/g, '$1 ')
  // 단어[ → 단어 [
  t = t.replace(/([A-Za-z가-힣0-9])(?=[\[【])/g, '$1 ')
  t = t.replace(/\s{2,}/g, ' ')
  return t.trim()
}

/**
 * 선두 가격·선착순·유류세 ZERO·■연휴/확정■ 등 판매 문구 제거.
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 선착순·만원·유류세 ZERO·■확정■ — manifest
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: NO 유류세인상 ≠ [인상] 잔재 — manifest
 */
export function stripSupplierTitleLeadingSalePromo(s: string): string {
  let t = String(s ?? '').trim()
  // ■추석연휴 / 출발확정■ · ■ _마지막 출발■ (unwrap 후에도 잔여 가능)
  t = t.replace(/■\s*[^■\n]{0,48}\s*■/g, ' ')
  // 선착순 2석 1329 -> 1299만원 …
  t = t.replace(
    /^(?:선착\s*순(?:\s*\d+\s*석)?(?:\s*특가)?\s*)?(?:\d{2,5}\s*(?:->|→|>|＞)\s*)?\d{2,5}\s*만\s*원\s*/i,
    '',
  )
  t = t.replace(/^선착\s*순(?:\s*\d+\s*(?:석|명))?(?:\s*특가)?\s*/i, '')
  t = t.replace(/^\d+\s*명\s*부터\s*출발\s*[\/·．.／]?\s*/i, '')
  // 유류 (세 없는 유류인상 NO 포함)
  t = t.replace(new RegExp(`^(?:${FUEL_SURCHARGE_RE.source})\\s*`, 'i'), '')
  t = t.replace(/^유류\s*세\s*(?:ZERO|제로|0)\s*/i, '')
  // 추석연휴특가 · 연휴특가 · 특가 · 취항특가(본문 접착)
  t = t.replace(/^(?:추석\s*|설\s*)?연휴\s*특가\s*/i, '')
  t = t.replace(/^(?:없는\s+)?(?:선착\s*순\s*)?특가\s*/i, '')
  t = t.replace(/^(?:추석|취항|기획|한정|초)특가\s*/i, '')
  t = t.replace(/^황금\s*연휴(?:특선|기간)?\s*/i, '')
  // 1석 예약시, 독실료 할인 가능
  t = t.replace(/^\d+\s*석\s*예약\s*시[,，]?\s*독실료\s*할인\s*(?:가능)?\s*/i, '')
  t = t.replace(/^독실료\s*할인\s*(?:가능)?\s*/i, '')
  // 선두 날짜
  t = t.replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일\s*/u, '')
  t = t.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*출발(?:\s*확정)?\s*[_\/]?\s*/u, '')
  // 선두 판매마감·출발확정·출발임박 등 (대괄호 없음)
  t = t.replace(
    /^(?:판매\s*(?:마감|완료|종료)|출발\s*확정|출발\s*임박|마감\s*임박|매진\s*임박|대기\s*예약|예약\s*마감|예약\s*가능|출발\s*가능|100\s*%\s*출발)\s*/i,
    '',
  )
  t = t.replace(/^\*+\s*(?:출발\s*확정|출발\s*임박)\s*/i, '')
  return tidyTitleSeparators(t)
}

/** 공백·NBSP·장식 쌍 래퍼·잔여 UI 장식 정리 */
export function stripSupplierTitleUiNoise(s: string): string {
  let t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  t = t.replace(/[\u00a0\u3000]+/g, ' ')
  t = unwrapDecorativeSymbolPairs(t)
  t = stripSupplierTitleLeadingSalePromo(t)
  for (const ch of UI_NOISE_CHARS) {
    t = t.split(ch).join('')
  }
  return tidyTitleSeparators(t)
}

function scrubPromoTokensInText(part: string): string {
  let t = String(part ?? '')
  t = t.replace(FUEL_SURCHARGE_RE, ' ')
  t = t.replace(TEUKGA_RE, ' ')
  t = t.replace(STATUS_WORD_RE, ' ')
  t = t.replace(CHANNEL_OR_COMPETITOR_RE, ' ')
  t = t.replace(NAMED_PROMO_RE, ' ')
  t = t.replace(/유류\s*세\s*(?:ZERO|제로|0)/gi, ' ')
  t = t.replace(/선착\s*순(?:\s*\d+\s*(?:석|명))?(?:\s*[^\s[\]【】/+·|]{0,24})?/gi, ' ')
  // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 초특가→초 잔재 금지 — manifest
  t = t.replace(/(?:초\s*)?특가/gi, ' ')
  t = t.replace(/한정(?:\s*특가)?/gi, ' ')
  t = t.replace(/\b(?:HIT|BEST|NEW|HOT|TKT|ONLY)\b/gi, ' ')
  // 날짜+상태 접두 (괄호 내부)
  t = t.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*(?:출발\s*확정|출발\s*임박)?[_ ]*/u, '')
  t = t.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*까지\s*/u, '')
  t = t.replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일\s*/u, '')
  t = t.replace(/^[_\/+\s,]+/, '')
  t = t.replace(/[_\/+\s,]+$/, '')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * [NO 유류세+브리즈번 시티투어] — 판매토큰만 걷고 지명·투어·노옵션·항공은 남김.
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: mixed promo bracket scrub — manifest
 */
function scrubMixedPromoBadgeInner(inner: string): string {
  let whole = String(inner ?? '').trim()
  // 날짜/상태 접두를 분리 전에 제거 → '[9/5 출발확정_베스트 오브 베스트]'
  whole = whole.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*출발\s*확정[_ ]*/u, '')
  whole = whole.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*까지\s*예약\s*가능[_\/ ]*/u, '')
  whole = whole.replace(/^잔여\s*[0-9①-⑳]+\s*석[_\/ ]*/u, '')
  whole = whole.replace(/^출발\s*확정[_ ]*/u, '')

  // 숫자/숫자 날짜의 / 는 분리하지 않음
  const pieces = whole.split(/([+·|,]|(?<!\d)\/(?!\d))/)
  const kept: string[] = []
  let pendingSep = ''
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    if (piece === undefined || piece === '') continue
    if (/^[+·|,/]$/.test(piece)) {
      pendingSep = piece
      continue
    }
    const trimmed = piece.trim()
    if (!trimmed) continue
    if (isPromoOnlyPart(trimmed)) {
      pendingSep = ''
      continue
    }
    const scrubbed = scrubPromoTokensInText(trimmed)
    if (!scrubbed || isPromoOnlyPart(scrubbed)) {
      pendingSep = ''
      continue
    }
    // 스크럽 잔재(초·특 등 1~2글자) 폐기
    if (
      scrubbed.length <= 2 &&
      trimmed.replace(/\s/g, '').length > scrubbed.replace(/\s/g, '').length
    ) {
      pendingSep = ''
      continue
    }
    if (kept.length && pendingSep) kept.push(pendingSep)
    else if (kept.length) kept.push('+')
    kept.push(scrubbed)
    pendingSep = ''
  }
  return kept.join('')
}

function isPromoOnlyPart(raw: string): boolean {
  const spaced = String(raw ?? '').trim()
  if (!spaced) return true
  if (isSupplierTitleBusinessCabinKeep(spaced)) return false
  const scrubbed = scrubPromoTokensInText(spaced)
  if (!scrubbed) return true
  let compact = scrubbed.replace(/\s/g, '')
  // 노/무 쇼핑·옵션·팁·직항·항공·출발도시· Semi-프리미엄 등은 콘텐츠
  if (
    /^(?:무(?:쇼핑|옵션|팁)|노(?:쇼핑|옵션|팁)|(?:no\s*)?(?:option|shopping|팁|옵션|쇼핑)|직항)$/i.test(
      compact,
    )
  ) {
    return false
  }
  if (
    /^(?:출발확정|출발임박|매진임박|마감임박|긴급모객|집중모객|판매마감|판매완료|잔여좌석|잔여석|단풍시즌|벚꽃시즌|눈꽃시즌|얼리마켓|여행핫딜|옐로팡딜|특별기획|트래블페스타|스테디셀러|베스트셀러|홈쇼핑|품격|클래스|초|한정|best|hit|new|hot|tkt|only|하나live|cj온스타일|sk스토아|sk스토어)$/i.test(
      compact,
    )
  ) {
    return true
  }
  if (/^tkt\s*[\/·．.／]\s*only$/i.test(spaced)) return true
  if (/^롯데관광\s*'?\s*단독$/i.test(spaced)) return true
  if (/^선착\s*순/i.test(spaced)) return true
  if (FUEL_SURCHARGE_RE.test(spaced)) {
    FUEL_SURCHARGE_RE.lastIndex = 0
    const onlyFuel = scrubPromoTokensInText(spaced)
    if (!onlyFuel) return true
  }
  FUEL_SURCHARGE_RE.lastIndex = 0
  return false
}

/**
 * `[출발확정]`·`[매진임박]`·`[best]` 등 마케팅/상태 대괄호 — [지역]·[항공사]·[노쇼핑]는 제외
 * (부분 일치가 아니라 배지 전체가 프로모일 때만 제거 — mixed는 scrubMixed 로 처리)
 */
const SUPPLIER_TITLE_PROMO_BADGE_INNER =
  /^(?:출발\s*확정|출발\s*임박|매진\s*임박|마감\s*임박|긴급\s*모객|집중\s*모객|선착\s*순(?:\s*\d+\s*(?:석|명))?|스테디\s*셀러|베스트\s*셀러|홈\s*쇼핑|품격|유류\s*(?:세|할증|인상|고정)|연휴\s*좌석|추석\s*연휴|설\s*연휴|판매\s*(?:마감|완료|종료)|예약\s*마감|예약\s*가능|잔여\s*좌석|잔여\s*[0-9①-⑳]+\s*석|잔여석|남은\s*좌석|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|얼리\s*마켓|여행\s*핫딜|옐로\s*팡딜|특별\s*기획|트래블\s*페스타|하나\s*LIVE|CJ\s*온\s*스타일|SK\s*스토아|SK\s*스토어|롯데\s*홈\s*쇼핑|GS\s*샵|현대\s*홈\s*쇼핑|NS\s*홈\s*쇼핑|공영\s*쇼핑|홈앤\s*쇼핑|롯데관광\s*'?\s*단독|(?:없는\s*)?특가|한정\s*특가|초\s*특가|황금\s*연휴(?:특선|기간)?|\bHIT\b|\bBEST\b|\bNEW\b|\bHOT\b|\bTKT\b|\bONLY\b)$/i

/**
 * 홈·등록대기 상품명에 쓰지 않는 판매상태·잔여석·캐빈·시즌 마케팅.
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 — manifest
 */
export const SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE =
  /판매\s*(?:마감|완료|종료)|예약\s*마감|마감\s*임박|출발\s*임박|잔여\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|잔여\s*[0-9①-⑳]+\s*석|잔여석(?:\s*[0-9①-⑳]+\s*석)?|남은\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|프리미엄\s*(?:이코노미(?:\s*클래스)?|이코노미)|비즈니스\s*석|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|왜\s*이제\s*왔을까|SNS\s*맛집/gi

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

function remainderAfterPromoAndCabin(spaced: string): string {
  let rest = stripHomepageForbiddenTitlePhrases(spaced)
  rest = scrubPromoTokensInText(rest)
  rest = rest.replace(/\[\s*비즈니스[^\]]*\]/gi, ' ')
  rest = rest.replace(/【\s*비즈니스[^】]*】/gi, ' ')
  rest = rest.replace(/비즈니스\s*[\/·．.／]*\s*클래스?/gi, ' ')
  rest = rest.replace(/비즈니스/gi, ' ')
  return rest.replace(/[\[\]【】#/·,\s_\-+]+/g, '').trim()
}

function isPromoOnlyBadgeText(raw: string): boolean {
  let spaced = unwrapTitleBadge(raw)
  if (!spaced) return true
  // `[비즈니스]` 는 제목에 유지 (목적지 판별은 isSupplierTitleNotDestinationToken)
  if (isSupplierTitleBusinessCabinKeep(spaced)) return false
  // 판매마감·단풍시즌·캐빈만으로 구성된 문자열 (목적지 오염 방지)
  if (!remainderAfterPromoAndCabin(spaced)) return true

  // 혼합 배지: 스크럽 후 남는 콘텐츠가 있으면 프로모-only 아님
  const scrubbedMixed = scrubMixedPromoBadgeInner(spaced)
  if (scrubbedMixed && scrubbedMixed.replace(/[\[\]【】#/·,\s+_+\-]+/g, '')) {
    if (SUPPLIER_TITLE_PROMO_BADGE_INNER.test(spaced)) return true
    // 스크럽이 원문과 다르면 mixed — 배지 전체 삭제가 아님
    if (scrubbedMixed !== spaced.trim()) return false
  } else if (!scrubbedMixed) {
    return true
  }

  let compact = spaced.replace(/\s/g, '')
  // 노쇼핑·노옵션·직항은 유지 (프로모 배지로 보지 않음)
  if (
    /^(?:무(?:쇼핑|옵션|팁)|노(?:쇼핑|옵션|팁)|(?:no\s*)?(?:option|shopping|팁|옵션|쇼핑)|직항|nooption|noshopping)$/i.test(
      compact,
    )
  ) {
    return false
  }
  if (/^no\s*(?:옵션|쇼핑|팁)$/i.test(spaced)) return false
  if (/^NO\s*(?:옵션|쇼핑|팁)$/i.test(spaced)) return false
  if (
    /^(?:출발확정|출발임박|매진임박|마감임박|긴급모객|집중모객|판매마감|판매완료|잔여좌석|잔여석|단풍시즌|벚꽃시즌|눈꽃시즌|얼리마켓|여행핫딜|옐로팡딜|특별기획|트래블페스타|클래스|초|한정|best|hit|new|hot|tkt|only)$/i.test(
      compact,
    )
  ) {
    return true
  }
  if (/^tkt\s*[\/·．.／]\s*only$/i.test(spaced)) return true
  if (/^[\/·．.／]+클래스$/i.test(spaced)) return true
  if (SUPPLIER_TITLE_PROMO_BADGE_INNER.test(spaced)) return true
  return false
}

/**
 * 등록 parse·preview 상품명 — UI 노이즈 + [출발확정] 등 마케팅 []·# 제거.
 * [다낭]·[동유럽]·#바나힐 등 지역·일반 해시는 유지. #노쇼핑 등도 유지.
 */
export function normalizeSupplierRegisterListingTitle(s: string): string {
  // REGRESSION-FREEZE[supplier-product-title-plan-b]: HTML 엔티티·중복 어절 공개 정리 — manifest
  const decoded = collapseAdjacentDuplicateTitlePhrases(decodePublicHtmlEntities(String(s ?? '')))
  return stripSupplierTitlePromoBadges(stripSupplierTitleUiNoise(decoded))
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

function stripBareTrailingHitBest(s: string): string {
  return String(s ?? '')
    .replace(/(?<=\s)\b(?:HIT|BEST)\b\s*$/i, '')
    .replace(/\b(?:HIT|BEST)\b\s*$/i, '')
    .trim()
}

function stripBareInlinePromoWords(s: string): string {
  let t = String(s ?? '')
  // 본문 취항특가·추석특가 (접착/공백 모두) — 특급/특식/특전은 '특가'가 아님
  t = t.replace(/(?:추석|취항|기획|한정|초)특가/g, '')
  t = t.replace(/없는\s+특가/g, '')
  t = t.replace(/(?:^|[\s\[])특가(?=[\s\]가-힣A-Za-z]|$)/g, ' ')
  t = t.replace(FUEL_SURCHARGE_RE, ' ')
  t = t.replace(/황금\s*연휴(?:특선|기간)?/gi, ' ')
  t = t.replace(/웹\s*예약\s*\d+\s*만\s*원\s*할인/gi, ' ')
  t = t.replace(/롯데관광\s*'?\s*단독/gi, ' ')
  // 선두/공백 뒤 상태어
  t = t.replace(/(?<=[\s\/·,，\*\[])(?:출발\s*임박|집중\s*모객)(?=[\s\/·,，\]]|$)/gi, ' ')
  return t
}

/** 무쇼핑·무옵션이 아닌 판매 배지만 제거 — [지역]·[항공사]·[노쇼핑]·일반 #태그는 유지. `[비즈니스]`는 유지. */
export function stripSupplierTitlePromoBadges(s: string): string {
  let t = foldBusinessCabinKeepBrackets(stripSupplierTitleLeadingSalePromo(s))
  const scrubBracket = (_m: string, inner: string) => {
    if (isPromoOnlyBadgeText(inner)) return ' '
    const scrubbed = scrubMixedPromoBadgeInner(inner)
    if (!scrubbed) return ' '
    if (scrubbed !== inner.trim()) {
      if (isPromoOnlyBadgeText(scrubbed)) return ' '
      return `[${scrubbed}]`
    }
    return _m
  }
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, scrubBracket)
  t = t.replace(/【\s*([^】]*?)\s*】/g, (m, inner: string) => {
    if (isPromoOnlyBadgeText(inner)) return ' '
    const scrubbed = scrubMixedPromoBadgeInner(inner)
    if (!scrubbed) return ' '
    if (scrubbed !== inner.trim()) {
      if (isPromoOnlyBadgeText(scrubbed)) return ' '
      return `【${scrubbed}】`
    }
    return m
  })
  // 해시: 스트립 대상 단어만 제거. #노쇼핑·#특급호텔·지역 해시 유지
  t = t.replace(/#\s*([^\s#]+)/g, (m, body: string) => {
    if (isPromoOnlyBadgeText(body)) return ' '
    const scrubbed = scrubPromoTokensInText(body)
    if (!scrubbed) return ' '
    // 해시 본문이 특가/상태만이면 제거
    if (/(?:특가|출발확정|출발임박|얼리마켓|여행핫딜|HIT|BEST)/i.test(body) && !scrubbed) return ' '
    if (scrubbed !== body.trim() && !scrubbed.replace(/[\/·_\-\s]/g, '')) return ' '
    // 본문에서 특가 등만 빠진 경우 해시 유지(희귀) — 전부 프로모면 위에서 제거
    if (isPromoOnlyPart(body)) return ' '
    return m
  })
  t = stripHomepageForbiddenTitlePhrases(t)
  t = stripBareInlinePromoWords(t)
  t = t.replace(/\[\s*[\/·．.／]*\s*클래스\s*\]/gi, ' ')
  t = t.replace(/\[\s*\]/g, ' ')
  // 선두에 남은 "추석연휴 / 출발확정" 등 (■ 제거 후)
  t = t.replace(/^(?:추석\s*연휴|설\s*연휴|연휴\s*좌석)\s*[\/·]?\s*(?:출발\s*확정)?\s*/i, '')
  t = t.replace(/^(?:출발\s*확정|출발\s*임박)\s*[\/·]?\s*/i, '')
  t = t.replace(/^(?:마지막\s*출발|_?\s*마지막\s*출발)\s*/i, '')
  t = t.replace(/^(?:선착\s*순\s*)?특가\s*/i, '')
  t = t.replace(/^(?:추석|취항|기획|한정|초)특가\s*/i, '')
  t = t.replace(/^황금\s*연휴(?:특선|기간)?\s*/i, '')
  t = t.replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일\s*/u, '')
  // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 본문 출발확정·판매마감 — manifest
  t = t.replace(/(?<=[\s\/·,，\*])출발\s*확정(?=[\s\/·,，\[]|$)/gi, ' ')
  t = t.replace(/(?<=[\s\/·,，])판매\s*(?:마감|완료|종료)(?=[\s\/·,，『「]|$)/gi, ' ')
  // 해시태그 안 N인이상출발확정
  t = t.replace(/#\s*\d+\s*인\s*이상\s*출발\s*확정/gi, ' ')
  t = t.replace(/\/{2,}/g, '/')
  t = stripBareTrailingHitBest(t)
  return tidyTitleSeparators(t)
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
