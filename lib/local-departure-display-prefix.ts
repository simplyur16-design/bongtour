/**
 * 지방출발 표시 머리말 — 공개 상품명 맨 앞 `[부산출발]`·`[대구출발]`·`[청주출발]`·`[제주출발]`.
 * REGRESSION-FREEZE[local-departure-display-prefix]: 소유자 지시(2026-10-27) — manifest
 *
 * - 근거는 `Product.localDepartureTag` (없으면 `Product.departureAirportLabel`) 뿐. 제목에서 추론하지 않는다.
 * - 표시 전용 — `Product.title` 은 절대 쓰지 않는다(heal·등록 저장 경로 무관).
 * - 지방출발은 이름에 **정확히 한 번**만(소유자 지시 2026-10-27 10:05): 시작 괄호에 이미 있으면 그대로 두고,
 *   없으면 맨 앞에 `[X출발] ` 하나를 붙인다. 그 밖의 같은 도시 출발 표기(`[청주출발]`, `[Semi-프리미엄+청주출발]` 안의
 *   조각, `#청주출발`, `부산오전출발`)는 표시명에서 지운다. 다른 도시·항공사(`제주항공`)·해외(`오사카출발`)는 건드리지 않는다.
 * - 클라이언트 번들 안전(서버 전용 import 없음).
 */
import {
  LOCAL_DEPARTURE_TAG_LABELS,
  LOCAL_DEPARTURE_TAG_VALUES,
  type LocalDepartureTag,
} from '@/lib/product-listing-kind'

const TAG_SET = new Set<string>(LOCAL_DEPARTURE_TAG_VALUES)

/** 도시와 출발 사이 시간대 표기 (`부산오전출발`) */
const TIME_OF_DAY = '(?:오전|오후|아침|저녁|새벽|야간|밤|낮)'

/** 태그별 `{city}[항|공항][시간대]출발` 토큰 — 앞이 한글이면 다른 단어(예: `오사카출발`·`제주항공`)이므로 제외 */
const CITY_TOKEN_SRC: Record<LocalDepartureTag, string> = {
  busan: `(?:부산|김해)(?:\\s*(?:국제)?\\s*(?:항|공항))?(?:\\s*${TIME_OF_DAY})?\\s*출발`,
  cheongju: `청주(?:\\s*(?:국제)?\\s*공항)?(?:\\s*${TIME_OF_DAY})?\\s*출발`,
  daegu: `대구(?:\\s*(?:국제)?\\s*공항)?(?:\\s*${TIME_OF_DAY})?\\s*출발`,
  jeju: `제주(?:\\s*(?:국제)?\\s*(?:항|공항))?(?:\\s*${TIME_OF_DAY})?\\s*출발`,
}

function cityTokenRe(tag: LocalDepartureTag, flags = 'g'): RegExp {
  return new RegExp(`(?<![가-힣A-Za-z])${CITY_TOKEN_SRC[tag]}`, flags)
}

/** `departureAirportLabelDisplay`(예: "부산공항") → 태그 — 구 캐시 상세 DTO 폴백 */
const AIRPORT_DISPLAY_TO_TAG: Record<string, LocalDepartureTag> = {
  부산공항: 'busan',
  청주공항: 'cheongju',
  대구공항: 'daegu',
  제주공항: 'jeju',
}

function normalizeTagList(raw: unknown): LocalDepartureTag[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const seen = new Set<string>()
  for (const v of arr) {
    if (typeof v !== 'string') continue
    const s = v.trim().toLowerCase()
    if (TAG_SET.has(s)) seen.add(s)
  }
  return LOCAL_DEPARTURE_TAG_VALUES.filter((k) => seen.has(k))
}

export type LocalDepartureDisplaySource = {
  localDepartureTag?: readonly string[] | string | null
  departureAirportLabel?: string | null
}

/**
 * 표시용 지방출발 태그 — `localDepartureTag` 우선, 비어 있으면 `departureAirportLabel`(busan|cheongju|daegu|jeju).
 * 김포·인천·null → 빈 배열. 제목은 보지 않는다.
 */
export function resolveDisplayLocalDepartureTags(src: LocalDepartureDisplaySource | null | undefined): LocalDepartureTag[] {
  if (!src) return []
  const fromTags = normalizeTagList(src.localDepartureTag)
  if (fromTags.length) return fromTags
  return normalizeTagList(src.departureAirportLabel ?? null)
}

/** "부산공항" 등 표시 문자열 → 태그 (상세 DTO 폴백) */
export function localDepartureTagsFromAirportDisplay(display: string | null | undefined): LocalDepartureTag[] {
  const k = String(display ?? '').replace(/\s+/g, '')
  const hit = AIRPORT_DISPLAY_TO_TAG[k]
  return hit ? [hit] : []
}

/**
 * 상세 화면 product(공개 DTO) → 태그. `localDepartureDisplayTags`(신규 DTO) 우선,
 * 없으면(구 캐시 payload) `departureAirportLabelDisplay` 폴백.
 */
export function resolveDetailLocalDepartureTags(product: object | null | undefined): LocalDepartureTag[] {
  if (!product) return []
  const p = product as Record<string, unknown>
  if (Array.isArray(p.localDepartureDisplayTags)) {
    const t = normalizeTagList(p.localDepartureDisplayTags)
    if (t.length) return t
  }
  return localDepartureTagsFromAirportDisplay(
    typeof p.departureAirportLabelDisplay === 'string' ? p.departureAirportLabelDisplay : null,
  )
}

/** `[부산출발]` 등 — 태그 순서대로 이어 붙임 */
export function localDepartureDisplayPrefixText(tags: readonly LocalDepartureTag[]): string {
  return tags.map((t) => `[${LOCAL_DEPARTURE_TAG_LABELS[t]}]`).join(' ')
}

const JOINER_SPLIT_RE = /(\s*[+/,·&]\s*|\s+)/

/** 괄호 안쪽에서 해당 도시 출발 조각과 그 접속 기호를 지운다. 빈 괄호가 되면 '' */
function stripTokensInsideBracket(inner: string, res: readonly RegExp[]): string {
  const MARK = '\u0000'
  let marked = inner
  for (const re of res) marked = marked.replace(new RegExp(re.source, 'gu'), MARK)
  if (!marked.includes(MARK)) return inner
  const pieces = marked.split(JOINER_SPLIT_RE)
  const kept: { sep: string; text: string }[] = []
  for (let i = 0; i < pieces.length; i += 2) {
    const sep = i === 0 ? '' : pieces[i - 1] ?? ''
    const t = (pieces[i] ?? '').split(MARK).join('').replace(/^#+$/, '').trim()
    if (!t) continue
    kept.push({ sep, text: t })
  }
  return kept.map((k, i) => (i === 0 ? k.text : `${k.sep}${k.text}`)).join('').trim()
}

/** 괄호 밖 평문에서 `#청주출발`·`청주출발`·`부산오전출발` 토큰(앞뒤 접속 기호 하나 포함)을 지운다 */
function stripTokensInPlainText(text: string, res: readonly RegExp[]): string {
  let out = text
  for (const re of res) {
    const tok = `#?${re.source}`
    out = out
      .replace(new RegExp(`${tok}\\s*[+/,·&]\\s*`, 'gu'), '')
      .replace(new RegExp(`\\s*[+/,·&]\\s*${tok}`, 'gu'), '')
      .replace(new RegExp(tok, 'gu'), ' ')
  }
  return out
}

function stripCityDepartureMentions(text: string, tags: readonly LocalDepartureTag[]): string {
  if (!text || tags.length === 0) return text
  const res = tags.map((t) => cityTokenRe(t, 'g'))
  let out = ''
  let last = 0
  const bracketRe = /\[([^\]]*)\]/g
  for (let m = bracketRe.exec(text); m; m = bracketRe.exec(text)) {
    out += stripTokensInPlainText(text.slice(last, m.index), res)
    const inner = stripTokensInsideBracket(m[1] ?? '', res)
    out += inner ? `[${inner}]` : ' '
    last = m.index + m[0].length
  }
  out += stripTokensInPlainText(text.slice(last), res)
  return out
}

function tidyDisplayName(s: string): string {
  return s
    .replace(/\[\s*\]/g, ' ')
    .replace(/[ \t\u00a0]{2,}/g, ' ')
    .replace(/\s+([,·])/g, '$1')
    .replace(/(?:^|\s)#(?=\s|$)/g, ' ')
    .replace(/[ \t\u00a0]{2,}/g, ' ')
    .trim()
}

/** 이름 안 해당 도시 출발 표기 개수 (불변식 테스트·감사용) */
export function countLocalDepartureMentions(title: string | null | undefined, tag: LocalDepartureTag): number {
  return (String(title ?? '').match(cityTokenRe(tag, 'g')) ?? []).length
}

/**
 * 지방출발 표시명 — 태그 도시마다 맨 앞에 정확히 한 번.
 * 1) 이름 맨 앞 연속 괄호 중 태그 도시 출발을 담은 괄호(`[청주출발+동선최소화]` 포함)는 그대로 둔다(첫 비해당 괄호에서 멈춤).
 * 2) 나머지 부분에서 태그 도시 출발 표기를 모두 지운다(다른 도시·항공사·해외 출발은 유지).
 * 3) 시작 괄호에 없던 태그는 `[X출발] ` 로 맨 앞에 붙인다(표준 순서). `Product.title` 은 쓰지 않는다.
 */
export function applyLocalDepartureDisplayPrefix(
  title: string | null | undefined,
  tags: readonly LocalDepartureTag[] | null | undefined,
): string {
  const name = String(title ?? '')
  const list = normalizeTagList(tags ?? [])
  if (!name.trim() || list.length === 0) return name
  const remaining = new Set<LocalDepartureTag>(list)
  let head = ''
  let rest = name
  for (;;) {
    if (remaining.size === 0) break
    const m = rest.match(/^\s*\[([^\]]*)\]/)
    if (!m) break
    const inner = m[1] ?? ''
    const hits = [...remaining].filter((t) => cityTokenRe(t, '').test(inner))
    if (hits.length === 0) break
    for (const t of hits) remaining.delete(t)
    head += m[0]
    rest = rest.slice(m[0].length)
  }
  const restHadMention = list.some((t) => cityTokenRe(t, '').test(rest))
  const missing = list.filter((t) => remaining.has(t))
  if (missing.length === 0 && !restHadMention) return name
  const cleanedRest = restHadMention ? stripCityDepartureMentions(rest, list) : rest
  const body = tidyDisplayName(`${head.trim()}${head && /^\s/.test(rest) ? ' ' : ''}${cleanedRest}`)
  if (missing.length === 0) return body
  return body ? `${localDepartureDisplayPrefixText(missing)} ${body}` : localDepartureDisplayPrefixText(missing)
}

/** 상세 히어로 short/listing 양쪽에 동일 머리말 */
export function applyLocalDeparturePrefixToHeroTitles<T extends { heroTitle: string; listingTitle: string }>(
  titles: T,
  tags: readonly LocalDepartureTag[] | null | undefined,
): T {
  if (!tags || tags.length === 0) return titles
  return {
    ...titles,
    heroTitle: applyLocalDepartureDisplayPrefix(titles.heroTitle, tags),
    listingTitle: applyLocalDepartureDisplayPrefix(titles.listingTitle, tags),
  }
}
