/**
 * 방안 B — 공급사 원문 기반 노출 상품명(Product.title) SSOT.
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 홈 미사용 — manifest
 * 마케팅 축약·R-5 LLM 자동 저장 금지 — Product.title 노출명 SSOT.
 *
 * plan-b-v7: v6 + 쇼핑엔티·홈쇼핑에디션·유류비/유류인상 통째 제거· stray *·불균형 `[`.
 * 노쇼핑·노옵션·항공·출발도시·[2030전용]·[비즈니스/클래스]·[품격]·#베스트셀러 등은 유지.
 * 등록 시 Product.title 은 공급사 원문 그대로 저장; 본 정리는 노출(디스플레이) 전용.
 *
 * - originalTitle / Product.title: 붙여넣기·파싱 원문(최소 trim) — 저장 시 클린하지 않음
 * - display title: UI 노이즈·판매 문구만 제거, 나머지 원문 유지 (list/detail/compare/admin)
 */
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import { normalizeNaeiltourRegisterListingTitle } from '@/lib/naeiltour-register-product-title'
import {
  collapseAdjacentDuplicateTitlePhrases,
  decodePublicHtmlEntities,
} from '@/lib/decode-public-html-entities'

export const SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION = 'plan-b-v7-2026-10-26'

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

/** 유류·할인 관련 (특급/특식/특전은 건드리지 않음 — '특가'만). 유류비/유류인상 없음 포함. */
const FUEL_SURCHARGE_RE =
  /(?:NO\s*)?유류\s*(?:비|세|할증(?:료)?)?(?:\s*(?:고정|인상|인하|ZERO|제로|0|차액!?|없음|NO))?(?:\s*(?:NO|없음))?|(?:예약\s*시\s*)?유류\s*(?:비\s*)?(?:세\s*)?(?:인상|고정|할증)(?:\s*(?:NO|없음))?|유류\s*(?:비\s*)?(?:세\s*)?(?:인상|고정)\s*NO/gi

const TEUKGA_RE = /(?:없는\s+)?(?:추석|취항|기획|한정|초|연휴|황금\s*연휴)?\s*특가|(?:추석|취항|기획|한정|초)특가/gi

const STATUS_WORD_RE =
  /출발\s*확정|출발\s*임박|마감\s*임박|매진\s*임박|대기\s*예약|예약\s*마감|판매\s*(?:마감|완료|종료)|예약\s*가능|출발\s*가능|100\s*%\s*출발|잔여\s*좌석|잔여석|남은\s*좌석|좌석\s*(?:마감|부족)|긴급\s*모객|집중\s*모객|무조건\s*출발/gi

const N_PAX_DEPARTURE_CONFIRM_RE =
  /\d+\s*(?:명|인)\s*(?:이상|부터)\s*출발\s*확정/gi

const CHANNEL_OR_COMPETITOR_RE =
  /하나\s*LIVE|CJ\s*온\s*스타일|SK\s*스토아|SK\s*스토어|롯데\s*홈\s*쇼핑|GS\s*샵|현대\s*홈\s*쇼핑|NS\s*홈\s*쇼핑|공영\s*쇼핑|홈앤\s*쇼핑|쇼핑\s*엔티|롯데관광\s*'?\s*단독/gi

/** 품격·베스트셀러는 상품 라인명으로 유지. 스테디셀러·홈쇼핑(에디션)·핫딜 등만 프로모. */
const NAMED_PROMO_RE =
  /얼리\s*마켓|여행\s*핫딜|옐로\s*팡딜|특별\s*기획|트래블\s*페스타|스테디\s*셀러|홈\s*쇼핑(?:\s*에디션)?|황금\s*연휴(?:특선|기간)?|선착\s*순(?:\s*\d+\s*(?:석|명))?/gi

const DISCOUNT_PROMO_RE =
  /(?:소아\s*)?반값\s*할인|소아\s*반값|(?:최대\s*)?\d+\s*%\s*할인/gi

function badgeInnerHasSalePromoNoise(inner: string): boolean {
  const s = String(inner ?? '')
  for (const re of [
    TEUKGA_RE,
    STATUS_WORD_RE,
    FUEL_SURCHARGE_RE,
    DISCOUNT_PROMO_RE,
    N_PAX_DEPARTURE_CONFIRM_RE,
  ]) {
    re.lastIndex = 0
    if (re.test(s)) {
      re.lastIndex = 0
      return true
    }
    re.lastIndex = 0
  }
  return /(?:없는\s+)?특가|선착\s*순|황금\s*연휴|웹\s*예약\s*\d+\s*만\s*원\s*할인|무조건\s*출발/i.test(
    s,
  )
}

/**
 * ★…★ / ▶…◀ 등 쌍 래퍼.
 * - 프로모/상태만 → 통째 제거
 * - 프로모 혼합인데 `/` 상품 분리가 없으면 통째 제거 (★썬푸꾸옥 취항특가★)
 * - `/` 혼합 (★출발확정/대형기탑승★) → 비스테이터스만 남김
 * ~웹예약N만원할인~ 래퍼는 통째로 제거.
 */
function unwrapDecorativeSymbolPairs(s: string): string {
  let t = String(s ?? '')
  const replacePair = (_m: string, inner: string) => {
    const trimmed = String(inner ?? '').trim()
    if (!trimmed) return ' '
    if (isPromoOnlyBadgeText(trimmed)) return ' '
    const hasProductSlash = /(?<!\d)\/(?!\d)/.test(trimmed)
    if (badgeInnerHasSalePromoNoise(trimmed) && !hasProductSlash) return ' '
    if (hasProductSlash) {
      const scrubbed = scrubMixedPromoBadgeInner(trimmed)
      return scrubbed ? ` ${scrubbed} ` : ' '
    }
    return ` ${trimmed} `
  }
  t = t.replace(/★([^★\n]{0,80})★/g, replacePair)
  t = t.replace(/▶([^◀\n]{0,80})◀/g, replacePair)
  t = t.replace(/◐([^◑\n]{0,80})◑/g, replacePair)
  t = t.replace(/●([^●\n]{0,80})●/g, replacePair)
  t = t.replace(/■\s*([^■\n]{0,48})\s*■/g, replacePair)
  t = t.replace(/◆([^◆\n]{0,48})◆/g, replacePair)
  t = t.replace(/~[^~\n]{0,48}할인~/g, ' ')
  t = t.replace(/웹\s*예약\s*\d+\s*만\s*원\s*할인/gi, ' ')
  return t
}

function tidyTitleSeparators(s: string): string {
  let t = String(s ?? '')
  // 괄호 안 stray * (프로모 스크럽 잔재)
  t = t.replace(/\[([^\]]*)\]/g, (_m, inner: string) => {
    const cleaned = String(inner).replace(/[*＊]+/g, ' ').replace(/\s+/g, ' ').trim()
    return cleaned ? `[${cleaned}]` : ' '
  })
  // 빈 괄호
  t = t.replace(/\[\s*\]/g, ' ')
  t = t.replace(/\(\s*\)/g, ' ')
  t = t.replace(/【\s*】/g, ' ')
  // 괄호 안 선두/후미 구분자 (대시 포함 — 【-보라빛물결】)
  t = t.replace(/\[\s*[\/_\-+,.*＊\s]+/g, '[')
  t = t.replace(/[\/_\-+,.*＊\s]+\s*\]/g, ']')
  t = t.replace(/【\s*[\/_\-+,.\s]+/g, '【')
  t = t.replace(/[\/_\-+,.\s]+\s*】/g, '】')
  // 제목 선두/후미 구분자·깨진 기호 (* 포함)
  t = t.replace(/^[*＊·•‧\/_\-+,.\s]+/g, '')
  t = t.replace(/[*＊·•‧\/_\-+,\s]+$/g, '')
  // 본문 stray *
  t = t.replace(/[*＊]+/g, ' ')
  // 불균형 선두 `[` (닫는 ] 없음)
  if ((t.match(/\[/g) || []).length > (t.match(/\]/g) || []).length) {
    t = t.replace(/^\[\s*/, '')
  }
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
    /^(?:판매\s*(?:마감|완료|종료)|출발\s*확정|출발\s*임박|마감\s*임박|매진\s*임박|대기\s*예약|예약\s*마감|예약\s*가능|출발\s*가능|100\s*%\s*출발|무조건\s*출발)\s*/i,
    '',
  )
  t = t.replace(/^\*+\s*(?:출발\s*확정|출발\s*임박|무조건\s*출발)\s*/i, '')
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

/** 유류 스크럽이 `NO옵션`의 NO 를 삼키지 않도록 콘텐츠 토큰 보호 */
const TITLE_CONTENT_KEEP_TOKEN_RE =
  /(?:무|노|NO)\s*(?:쇼핑|옵션|팁)|(?:no\s*)?(?:option|shopping)/gi

function withProtectedTitleContentTokens(s: string, fn: (t: string) => string): string {
  const held: string[] = []
  const masked = String(s ?? '').replace(TITLE_CONTENT_KEEP_TOKEN_RE, (m) => {
    const i = held.length
    held.push(m)
    return `\uE000${i}\uE001`
  })
  const out = fn(masked)
  return out.replace(/\uE000(\d+)\uE001/g, (_m, n: string) => held[Number(n)] ?? '')
}

function scrubPromoTokensInText(part: string): string {
  return withProtectedTitleContentTokens(part, (raw) => {
    let t = raw
    // N명이상 출발확정 은 토큰 단위로 먼저 통째 제거 (4명이상 잔재 금지)
    t = t.replace(N_PAX_DEPARTURE_CONFIRM_RE, ' ')
    t = t.replace(FUEL_SURCHARGE_RE, ' ')
    t = t.replace(TEUKGA_RE, ' ')
    t = t.replace(STATUS_WORD_RE, ' ')
    t = t.replace(CHANNEL_OR_COMPETITOR_RE, ' ')
    t = t.replace(NAMED_PROMO_RE, ' ')
    t = t.replace(DISCOUNT_PROMO_RE, ' ')
    t = t.replace(/유류\s*(?:비|세)\s*(?:ZERO|제로|0|NO인상|인상\s*NO|인상\s*없음)/gi, ' ')
    t = t.replace(/선착\s*순(?:\s*\d+\s*(?:석|명))?(?:\s*[^\s[\]【】/+·|]{0,24})?/gi, ' ')
    // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 초특가→초 잔재 금지 — manifest
    t = t.replace(/(?:초\s*)?특가/gi, ' ')
    t = t.replace(/한정(?:\s*특가)?/gi, ' ')
    // HIT/BEST 등은 독립 토큰만 (위치BEST·#위치BEST 유지)
    t = t.replace(/(?<![A-Za-z가-힣])(?:HIT|BEST|NEW|HOT|TKT|ONLY)(?![A-Za-z가-힣])/gi, ' ')
    // 날짜+상태 접두 (괄호 내부)
    t = t.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*(?:출발\s*확정|출발\s*임박)?[_ ]*/u, '')
    t = t.replace(/^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*까지\s*/u, '')
    t = t.replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일\s*/u, '')
    // 연료 스크럽 후 stray *
    t = t.replace(/[*＊]+/g, ' ')
    t = t.replace(/^[-–—_\/+\s,]+/, '')
    t = t.replace(/[-–—_\/+\s,]+$/, '')
    return t.replace(/\s+/g, ' ').trim()
  })
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
    if (kept.length && pendingSep) {
      // 쉼표 뒤 공백 유지: '[가볍게 떠나는 여행, LITE TRIP]'
      if (pendingSep === ',' || pendingSep === '，') kept.push(`${pendingSep} `)
      else kept.push(pendingSep)
    } else if (kept.length) kept.push('+')
    kept.push(scrubbed)
    pendingSep = ''
  }
  return kept.join('')
}

function isPromoOnlyPart(raw: string): boolean {
  const spaced = String(raw ?? '').trim()
  if (!spaced) return true
  if (isSupplierTitleBusinessCabinKeep(spaced)) return false
  // [품격]·베스트셀러는 상품 라인 — 프로모 아님
  if (/^품격$/i.test(spaced.replace(/\s/g, ''))) return false
  if (/^베스트\s*셀러$/i.test(spaced)) return false
  N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
  if (N_PAX_DEPARTURE_CONFIRM_RE.test(spaced)) {
    N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
    const onlyNPax = scrubPromoTokensInText(spaced)
    if (!onlyNPax) return true
  }
  N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
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
    /^(?:출발확정|출발임박|매진임박|마감임박|긴급모객|집중모객|무조건출발|판매마감|판매완료|잔여좌석|잔여석|단풍시즌|벚꽃시즌|눈꽃시즌|얼리마켓|여행핫딜|옐로팡딜|특별기획|트래블페스타|스테디셀러|홈쇼핑|클래스|초|한정|best|hit|new|hot|tkt|only|하나live|cj온스타일|sk스토아|sk스토어)$/i.test(
      compact,
    )
  ) {
    return true
  }
  if (/^tkt\s*[\/·．.／]\s*only$/i.test(spaced)) return true
  if (/^롯데관광\s*'?\s*단독$/i.test(spaced)) return true
  if (/^선착\s*순/i.test(spaced)) return true
  DISCOUNT_PROMO_RE.lastIndex = 0
  if (DISCOUNT_PROMO_RE.test(spaced) && !scrubPromoTokensInText(spaced)) return true
  DISCOUNT_PROMO_RE.lastIndex = 0
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
  /^(?:출발\s*확정|출발\s*임박|매진\s*임박|마감\s*임박|긴급\s*모객|집중\s*모객|무조건\s*출발|선착\s*순(?:\s*\d+\s*(?:석|명))?|스테디\s*셀러|홈\s*쇼핑(?:\s*에디션)?|쇼핑\s*엔티|유류\s*(?:비|세|할증|인상|고정)(?:\s*(?:NO|없음|인상|고정))*|NO\s*유류(?:\s*(?:비|세|할증|인상))*|연휴\s*좌석|추석\s*연휴|설\s*연휴|판매\s*(?:마감|완료|종료)|예약\s*마감|예약\s*가능|잔여\s*좌석|잔여\s*[0-9①-⑳]+\s*석|잔여석|남은\s*좌석|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|얼리\s*마켓|여행\s*핫딜|옐로\s*팡딜|특별\s*기획|트래블\s*페스타|하나\s*LIVE|CJ\s*온\s*스타일|SK\s*스토아|SK\s*스토어|롯데\s*홈\s*쇼핑|GS\s*샵|현대\s*홈\s*쇼핑|NS\s*홈\s*쇼핑|공영\s*쇼핑|홈앤\s*쇼핑|롯데관광\s*'?\s*단독|(?:없는\s*)?특가|한정\s*특가|초\s*특가|황금\s*연휴(?:특선|기간)?|(?:소아\s*)?반값\s*할인|\d+\s*(?:명|인)\s*(?:이상|부터)\s*출발\s*확정|\bHIT\b|\bBEST\b|\bNEW\b|\bHOT\b|\bTKT\b|\bONLY\b)$/i

/**
 * 홈·등록대기 상품명에 쓰지 않는 판매상태·잔여석·캐빈·시즌 마케팅.
 * REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 판매마감·잔여좌석·단풍시즌 — manifest
 */
export const SUPPLIER_HOMEPAGE_FORBIDDEN_TITLE_PHRASE_RE =
  /판매\s*(?:마감|완료|종료)|예약\s*마감|마감\s*임박|출발\s*임박|잔여\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|잔여\s*[0-9①-⑳]+\s*석|잔여석(?:\s*[0-9①-⑳]+\s*석)?|남은\s*좌석(?:\s*[0-9①-⑳]+\s*석)?|좌석\s*(?:마감|부족)|대기\s*(?:예약|접수)|이코노미\s*클래스|프리미엄\s*(?:이코노미(?:\s*클래스)?|이코노미)|비즈니스\s*석|단풍\s*시즌|벚꽃\s*시즌|눈꽃\s*시즌|왜\s*이제\s*왔을까/gi

const CABIN_KEEP_INNER_RE =
  /^비즈니스(?:\s*[\/·．.／]+\s*클래스|\s*클래스|\s*[\/·．.／]+)?$/i

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
  // [품격]·[베스트셀러]·#베스트셀러 는 상품 라인명 유지
  if (/^품격$/i.test(spaced.replace(/\s/g, ''))) return false
  if (/^베스트\s*셀러$/i.test(spaced)) return false
  N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
  if (
    N_PAX_DEPARTURE_CONFIRM_RE.test(spaced) &&
    !scrubPromoTokensInText(spaced).replace(/[\[\]【】#/·,\s+_+\-]+/g, '')
  ) {
    N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
    return true
  }
  N_PAX_DEPARTURE_CONFIRM_RE.lastIndex = 0
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
    /^(?:출발확정|출발임박|매진임박|마감임박|긴급모객|집중모객|무조건출발|판매마감|판매완료|잔여좌석|잔여석|단풍시즌|벚꽃시즌|눈꽃시즌|얼리마켓|여행핫딜|옐로팡딜|특별기획|트래블페스타|클래스|초|한정|best|hit|new|hot|tkt|only)$/i.test(
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

function foldBusinessCabinKeepLabel(inner: string): string {
  const spaced = String(inner ?? '').trim()
  if (/클래스/i.test(spaced)) {
    if (/[\/·．.／]/.test(spaced)) return '[비즈니스/클래스]'
    return '[비즈니스 클래스]'
  }
  return '[비즈니스]'
}

function foldBusinessCabinKeepBrackets(s: string): string {
  let t = String(s ?? '')
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, (m, inner: string) =>
    isSupplierTitleBusinessCabinKeep(inner) ? foldBusinessCabinKeepLabel(inner) : m,
  )
  t = t.replace(/【\s*([^】]*?)\s*】/g, (m, inner: string) =>
    isSupplierTitleBusinessCabinKeep(inner) ? foldBusinessCabinKeepLabel(inner) : m,
  )
  // bare only — do not re-match inside already-folded `[비즈니스/클래스]`
  t = t.replace(/(?<![\[【])비즈니스\s*[\/·．.／]+\s*클래스(?![\]】])/gi, '[비즈니스/클래스]')
  t = t.replace(/(?<![\[【])비즈니스\s+클래스(?![\]】])/gi, '[비즈니스 클래스]')
  return t
}

function stripBareTrailingHitBest(s: string): string {
  // 독립 토큰 HIT/BEST 만 제거. #위치BEST 처럼 본문에 붙은 경우는 유지.
  return String(s ?? '')
    .replace(/(?<![A-Za-z가-힣])(?:HIT|BEST)\s*$/i, '')
    .trim()
}

function stripBareInlinePromoWords(s: string): string {
  return withProtectedTitleContentTokens(s, (raw) => {
    let t = raw
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
  })
}

/** 무쇼핑·무옵션이 아닌 판매 배지만 제거 — [지역]·[항공사]·[노쇼핑]·일반 #태그는 유지. `[비즈니스]`는 유지. */
export function stripSupplierTitlePromoBadges(s: string): string {
  let t = foldBusinessCabinKeepBrackets(stripSupplierTitleLeadingSalePromo(s))
  const scrubBracket = (_m: string, inner: string) => {
    // [비즈니스/클래스] 는 캐빈 유지 — mixed scrub 이 '클래스' 를 프로모로 버리지 않게
    if (isSupplierTitleBusinessCabinKeep(inner)) return foldBusinessCabinKeepLabel(inner)
    if (isPromoOnlyBadgeText(inner)) return ' '
    const scrubbed = scrubMixedPromoBadgeInner(inner)
    if (!scrubbed) return ' '
    if (scrubbed !== inner.trim()) {
      if (isSupplierTitleBusinessCabinKeep(scrubbed)) return foldBusinessCabinKeepLabel(scrubbed)
      if (isPromoOnlyBadgeText(scrubbed)) return ' '
      return `[${scrubbed}]`
    }
    return _m
  }
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, scrubBracket)
  t = t.replace(/【\s*([^】]*?)\s*】/g, (m, inner: string) => {
    if (isSupplierTitleBusinessCabinKeep(inner)) {
      const label = foldBusinessCabinKeepLabel(inner)
      return label.startsWith('[') ? `【${label.slice(1, -1)}】` : label
    }
    if (isPromoOnlyBadgeText(inner)) return ' '
    const scrubbed = scrubMixedPromoBadgeInner(inner)
    if (!scrubbed) return ' '
    if (scrubbed !== inner.trim()) {
      if (isSupplierTitleBusinessCabinKeep(scrubbed)) {
        const label = foldBusinessCabinKeepLabel(scrubbed)
        return label.startsWith('[') ? `【${label.slice(1, -1)}】` : label
      }
      if (isPromoOnlyBadgeText(scrubbed)) return ' '
      return `【${scrubbed}】`
    }
    return m
  })
  // 공백 포함 N명이상 출발확정 해시 통째 제거 (#4명이상 잔재 금지)
  t = t.replace(/#\s*\d+\s*(?:명|인)\s*(?:이상|부터)\s*출발\s*확정/gi, ' ')
  // 유류 해시(공백 포함) 통째 제거 — `#예약시 유류인상 없음` 잔재 금지
  t = t.replace(/#\s*예약\s*시\s*유류\s*(?:비\s*)?(?:세\s*)?(?:인상|할증|고정)(?:\s*없음)?/gi, ' ')
  t = t.replace(/#\s*(?:NO\s*)?유류\s*(?:비|세|할증|인상)[^\n#]{0,24}/gi, ' ')
  // 해시: 스트립 대상 단어만 제거. #노쇼핑·#특급호텔·#SNS맛집·#위치BEST·#베스트셀러 유지
  t = t.replace(/#\s*([^\s#]+)/g, (m, body: string) => {
    if (isPromoOnlyBadgeText(body)) return ' '
    if (/^베스트\s*셀러$/i.test(body)) return m
    const scrubbed = scrubPromoTokensInText(body)
    if (!scrubbed) return ' '
    // 해시 본문이 특가/상태/할인만이면 제거
    if (
      /(?:특가|출발확정|출발임박|얼리마켓|여행핫딜|반값\s*할인)/i.test(body) &&
      !scrubbed
    ) {
      return ' '
    }
    if (scrubbed !== body.trim() && !scrubbed.replace(/[\/·_\-\s]/g, '')) return ' '
    // 본문에서 특가 등만 빠진 경우 해시 유지(희귀) — 전부 프로모면 위에서 제거
    if (isPromoOnlyPart(body)) return ' '
    // #위치BEST 처럼 본문이 그대로면 유지 (독립 BEST 토큰만 위에서 제거)
    return m
  })
  t = stripHomepageForbiddenTitlePhrases(t)
  t = stripBareInlinePromoWords(t)
  t = t.replace(/\[\s*[\/·．.／]*\s*클래스\s*\]/gi, ' ')
  t = t.replace(/\[\s*\]/g, ' ')
  // 선두에 남은 "추석연휴 / 출발확정" 등 (■ 제거 후)
  t = t.replace(/^(?:추석\s*연휴|설\s*연휴|연휴\s*좌석)\s*[\/·]?\s*(?:출발\s*확정)?\s*/i, '')
  t = t.replace(/^(?:출발\s*확정|출발\s*임박|무조건\s*출발)\s*[\/·]?\s*/i, '')
  t = t.replace(/^(?:마지막\s*출발|_?\s*마지막\s*출발)\s*/i, '')
  t = t.replace(/^(?:선착\s*순\s*)?특가\s*/i, '')
  t = t.replace(/^(?:추석|취항|기획|한정|초)특가\s*/i, '')
  t = t.replace(/^황금\s*연휴(?:특선|기간)?\s*/i, '')
  t = t.replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일\s*/u, '')
  // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: 본문 출발확정·판매마감 — manifest
  t = t.replace(/(?<=[\s\/·,，\*])출발\s*확정(?=[\s\/·,，\[]|$)/gi, ' ')
  t = t.replace(/(?<=[\s\/·,，\*])무조건\s*출발(?=[\s\/·,，\[]|$)/gi, ' ')
  t = t.replace(/(?<=[\s\/·,，])판매\s*(?:마감|완료|종료)(?=[\s\/·,，『「]|$)/gi, ' ')
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

/**
 * 참좋은여행 항공 안내문이 상품명 자리에 들어온 경우
 * (예: `3박5일이스타항공 … 출·도착 시각은 … 항공여정보기 출발일변경`).
 * 실제 상품명 필드가 없으면 이름을 지어내지 않는다.
 */
export function isVerygoodtourAirlineScheduleNoticeTitle(raw: string): boolean {
  const t = String(raw ?? '')
  if (!t) return false
  if (/항공여정보기/i.test(t) && /출\s*·\s*도착|출발일변경/i.test(t)) return true
  if (/출\s*·\s*도착\s*시각은\s*현지/i.test(t) && /항공기\s*스케줄/i.test(t)) return true
  return false
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
