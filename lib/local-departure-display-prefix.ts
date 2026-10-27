/**
 * 지방출발 표시 머리말 — 공개 상품명 맨 앞 `[부산출발]`·`[대구출발]`·`[청주출발]`·`[제주출발]`.
 * REGRESSION-FREEZE[local-departure-display-prefix]: 소유자 지시(2026-10-27) — manifest
 *
 * - 근거는 `Product.localDepartureTag` (없으면 `Product.departureAirportLabel`) 뿐. 제목에서 추론하지 않는다.
 * - 표시 전용 — `Product.title` 은 절대 쓰지 않는다(heal·등록 저장 경로 무관).
 * - 이미 이름이 그 도시의 `[X출발…]` 괄호로 **시작**하면 중복으로 붙이지 않는다.
 *   도시가 이름 중간에만 있으면(예: `[NO유류인상][청주출발]…`) 맨 앞에 붙인다.
 * - 클라이언트 번들 안전(서버 전용 import 없음).
 */
import {
  LOCAL_DEPARTURE_TAG_LABELS,
  LOCAL_DEPARTURE_TAG_VALUES,
  type LocalDepartureTag,
} from '@/lib/product-listing-kind'

const TAG_SET = new Set<string>(LOCAL_DEPARTURE_TAG_VALUES)

/** 태그별 "이미 시작 괄호에 있음" 판정용 도시 표기 (괄호 내용이 `{city}[항|공항]출발` 로 시작) */
const LEADING_BRACKET_CITY_RE: Record<LocalDepartureTag, RegExp> = {
  busan: /^\s*(?:부산|김해)\s*(?:항|공항)?\s*출발/,
  cheongju: /^\s*청주\s*(?:공항)?\s*출발/,
  daegu: /^\s*대구\s*(?:공항)?\s*출발/,
  jeju: /^\s*제주\s*(?:항|공항)?\s*출발/,
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

/**
 * 이름 앞에 지방출발 머리말을 붙인다.
 * 이름 맨 앞의 연속 괄호들 중 아직 남은 도시의 `[X출발…]` 로 시작하는 괄호는 "이미 있음"으로 처리하고,
 * 첫 비일치 괄호에서 멈춘다. 남은 도시만 앞에 붙인다.
 */
export function applyLocalDepartureDisplayPrefix(
  title: string | null | undefined,
  tags: readonly LocalDepartureTag[] | null | undefined,
): string {
  const name = String(title ?? '')
  const list = normalizeTagList(tags ?? [])
  if (!name.trim() || list.length === 0) return name
  const remaining = new Set<LocalDepartureTag>(list)
  let rest = name
  for (;;) {
    if (remaining.size === 0) break
    const m = rest.match(/^\s*\[([^\]]*)\]/)
    if (!m) break
    const inner = m[1] ?? ''
    let hit: LocalDepartureTag | null = null
    for (const t of remaining) {
      if (LEADING_BRACKET_CITY_RE[t].test(inner)) {
        hit = t
        break
      }
    }
    if (!hit) break
    remaining.delete(hit)
    rest = rest.slice(m[0].length)
  }
  const missing = list.filter((t) => remaining.has(t))
  if (missing.length === 0) return name
  return `${localDepartureDisplayPrefixText(missing)} ${name.trimStart()}`
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
