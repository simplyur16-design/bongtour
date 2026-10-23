/**
 * 비슷한 일정 비교 — place·duration 클러스터 SSOT.
 * 메가메뉴 leaf(도시·국가 LC)만 키로 쓴다. 탭/권역 헤더(중국·일본·산동·인도네시아…)로 묶지 않는다.
 * REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 도시 클러스터·박일 정규화 — manifest
 */

import {
  composeHeroDayToken,
  durationHintFromTitle,
  scrubKrDepartureFromPlaceLabel,
} from '@/lib/bongtour-product-display-title-ssot'
import { buildMegaMenuSharedCityHaystackStopTerms } from '@/lib/mega-menu-city-haystack-terms'
import { MEGA_MENU_TAB_DEFINITIONS, type MegaMenuLeafDef } from '@/lib/mega-menu-regions.data'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

export type ComparePlaceCluster = {
  /** 매칭 키 (메가메뉴 leaf slug) */
  key: string
  /** URL·UI 표기 — 메가메뉴 leaf.label */
  label: string
}

type LeafDef = {
  key: string
  label: string
  /** 긴 별칭 우선 매칭 — 공유 스톱(중국·일본·대만…) 제외 */
  aliases: readonly string[]
}

/** 표기 흔들림 — 메가메뉴 라벨로 흡수 (공유 스톱에 안 넣음) */
const EXTRA_ALIASES_BY_LABEL: Readonly<Record<string, readonly string[]>> = {
  청도: ['칭다오'],
  북경: ['베이징'],
  상해: ['상하이'],
  광주: ['광저우'],
  서안: ['시안'],
  타이베이: ['타이페이'],
  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 호주/뉴질랜드 LC — 도시 dest도 같은 leaf — manifest
  '호주/뉴질랜드': [
    '시드니',
    'sydney',
    '멜버른',
    'melbourne',
    '브리즈번',
    'brisbane',
    '골드코스트',
    'gold coast',
    'goldcoast',
    '케언즈',
    'cairns',
    '퍼스',
    'perth',
    '애들레이드',
    'adelaide',
    '호바트',
    'hobart',
    '울룰루',
    'uluru',
    '에어즈락',
    'ayers rock',
    '오클랜드',
    'auckland',
    '퀸스타운',
    'queenstown',
    '크라이스트처치',
    'christchurch',
    '로토루아',
    'rotorua',
    '웰링턴',
    'wellington',
    '밀포드',
    'milford',
    '호주뉴질랜드',
    '호주 · 뉴질랜드',
    'australia new zealand',
  ],
}

/** 대만 단독 → 타이베이 (가오슝 등과 섞지 않음) */
const TAIWAN_BARE_RE = /^(?:대만|타이완|taiwan)$/i
const TAIWAN_OTHER_CITY_RE =
  /가오슝|kaohsiung|타이중|taichung|화롄|hualien|타로코|taroko|컨딩|kenting|타이난|tainan/i

function normalizeHay(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isHangulChar(c: string | undefined): boolean {
  if (!c) return false
  const code = c.charCodeAt(0)
  return code >= 0xac00 && code <= 0xd7a3
}

/**
 * alias 매칭 — 영문은 단어 경계, 한글은 앞뒤 한글 연장 금지(인도⊂인도네시아 방지).
 */
// REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 한글 부분일치 금지 — manifest
function aliasHits(hay: string, alias: string): boolean {
  const a = alias.trim()
  if (!a) return false
  if (/[a-z]/i.test(a)) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRe(a)}(?:$|[^a-z0-9])`, 'i').test(hay)
  }
  let from = 0
  while (from <= hay.length) {
    const idx = hay.indexOf(a, from)
    if (idx < 0) return false
    const before = hay[idx - 1]
    const after = hay[idx + a.length]
    if (!isHangulChar(before) && !isHangulChar(after)) return true
    from = idx + 1
  }
  return false
}

function leafKey(leaf: MegaMenuLeafDef): string {
  return citySlugFromTermsAndLabel(leaf.label, leaf.terms)
}

function collectLeafLabels(): Set<string> {
  const labels = new Set<string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) labels.add(leaf.label)
    }
  }
  return labels
}

/**
 * leaf가 아닌 그룹 헤더·browse country — 단독 hay면 비교 키로 쓰지 않음.
 * (오키나와처럼 헤더=도시 leaf 라벨인 경우는 제외)
 */
function collectNonLeafHeaderLabels(leafLabels: Set<string>): Set<string> {
  const headers = new Set<string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      for (const raw of [group.countryLabel, group.headerBrowseCountryLabel]) {
        const h = String(raw || '').trim()
        if (h.length < 2) continue
        if (leafLabels.has(h)) continue
        headers.add(h)
      }
    }
  }
  return headers
}

/**
 * 메가메뉴 전 leaf → 비교 카탈로그.
 * city·LC 모두 포함. 여러 도시에 공통인 토큰(중국·일본·대만·베트남…)은 alias에서 제거.
 */
// REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 메가메뉴 leaf만 · 중국≠홍콩·몽골 — manifest
function buildCompareLeavesFromMegaMenu(): readonly LeafDef[] {
  const stops = buildMegaMenuSharedCityHaystackStopTerms()
  // 그룹 헤더·browse country도 스톱 (산동/화동/중국 탭으로 묶기 금지)
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      const headers = [group.countryLabel, group.headerBrowseCountryLabel].filter(Boolean) as string[]
      for (const h of headers) {
        const low = h.trim().toLowerCase()
        if (low.length >= 2) stops.add(low)
      }
    }
  }

  const out: LeafDef[] = []
  const seenKey = new Set<string>()

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        const key = leafKey(leaf)
        if (seenKey.has(key)) continue
        seenKey.add(key)

        const raw = new Set<string>([leaf.label, ...leaf.terms])
        for (const extra of EXTRA_ALIASES_BY_LABEL[leaf.label] || []) raw.add(extra)

        const aliases = [...raw]
          .map((t) => t.trim())
          .filter((t) => t.length >= 2 && !stops.has(t.toLowerCase()))

        // 라벨은 항상 유지 (스톱에 걸려도 leaf 식별자)
        if (!aliases.some((a) => a === leaf.label)) aliases.unshift(leaf.label)

        out.push({ key, label: leaf.label, aliases })
      }
    }
  }
  return out
}

const COMPARE_LEAVES: readonly LeafDef[] = buildCompareLeavesFromMegaMenu()
const LEAF_LABELS = collectLeafLabels()
const NON_LEAF_HEADERS = collectNonLeafHeaderLabels(LEAF_LABELS)

/** 박일 정규화 — `3박5일`·`3박  5일` → `3박 5일` */
// REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 박일 정규화 — manifest
export function normalizeCompareDurationLabel(
  duration?: string | null,
  title?: string | null,
  totalDays?: number | null,
): string {
  const composed = composeHeroDayToken(duration, totalDays)
  if (composed) return normalizeHay(composed)
  const hint = durationHintFromTitle(title || '')
  return hint ? normalizeHay(hint) : ''
}

export function compareDurationsMatch(a: string, b: string): boolean {
  const na = normalizeCompareDurationLabel(a)
  const nb = normalizeCompareDurationLabel(b)
  return Boolean(na && nb && na === nb)
}

function resolveTaiwanBare(hay: string): ComparePlaceCluster | null {
  const compact = hay.replace(/\s+/g, '')
  if (!(TAIWAN_BARE_RE.test(hay) || TAIWAN_BARE_RE.test(compact))) return null
  if (TAIWAN_OTHER_CITY_RE.test(hay)) return null
  return { key: 'taipei', label: '타이베이' }
}

/**
 * hay에서 메가메뉴 leaf 클러스터 추출.
 * 나라·탭·비leaf 그룹 헤더 단독이면 null. 대만 단독(+다른 TW 도시 없음) → 타이베이.
 * scrub은 `/`를 가르므로 헤더 검사는 scrub 전에 한다.
 */
// REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 일본≠나라만 · 대만↔타이베이 · 청도≠홍콩 — manifest
export function resolveComparePlaceClusterFromHay(hayRaw: string): ComparePlaceCluster | null {
  const rawHay = normalizeHay(hayRaw)
  if (!rawHay) return null

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 비leaf 그룹 헤더 단독 금지 — manifest
  // scrubKrDepartureFromPlaceLabel 이 `/` 로 토큰을 갈라 스페인/포르투갈 등이 깨지기 전에 차단
  if (NON_LEAF_HEADERS.has(rawHay)) {
    return resolveTaiwanBare(rawHay)
  }

  const hay = normalizeHay(scrubKrDepartureFromPlaceLabel(hayRaw) || hayRaw)
  if (!hay) return null
  if (NON_LEAF_HEADERS.has(hay)) {
    return resolveTaiwanBare(hay)
  }

  let best: { leaf: LeafDef; aliasLen: number } | null = null
  for (const leaf of COMPARE_LEAVES) {
    for (const alias of leaf.aliases) {
      if (!aliasHits(hay, alias)) continue
      const len = alias.length
      if (!best || len > best.aliasLen) best = { leaf, aliasLen: len }
    }
  }
  if (!best) return resolveTaiwanBare(hay)

  // 동일 길이 alias로 서로 다른 leaf가 동시에 걸리면(스페인·포르투갈) 임의 선택 금지
  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 동률 다엽 모호하면 null — manifest
  const tiedKeys = new Set<string>()
  for (const leaf of COMPARE_LEAVES) {
    for (const alias of leaf.aliases) {
      if (alias.length !== best.aliasLen) continue
      if (!aliasHits(hay, alias)) continue
      tiedKeys.add(leaf.key)
      if (tiedKeys.size > 1) return null
    }
  }

  return { key: best.leaf.key, label: best.leaf.label }
}

export function resolveComparePlaceCluster(input: {
  placeQuery?: string | null
  primaryDestination?: string | null
  destination?: string | null
  title?: string | null
}): ComparePlaceCluster | null {
  const q = normalizeHay(input.placeQuery || '')
  if (q) {
    const fromQ = resolveComparePlaceClusterFromHay(q)
    if (fromQ) return fromQ
  }
  const destHay = [input.primaryDestination, input.destination].filter(Boolean).join(' · ')
  const fromDest = resolveComparePlaceClusterFromHay(destHay)
  if (fromDest) return fromDest
  return resolveComparePlaceClusterFromHay(String(input.title || ''))
}

/** 쿼리 place + 상품 필드가 같은 메가메뉴 leaf인지 */
export function comparePlaceClustersMatch(
  want: ComparePlaceCluster | null,
  product: ComparePlaceCluster | null,
): boolean {
  if (!want?.key || !product?.key) return false
  return want.key === product.key
}
