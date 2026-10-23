/**
 * primaryDestination ↔ 메가메뉴 leaf 정합 SSOT.
 * 도시 leaf가 있으면 도시 라벨, 없으면 국가 leaf 라벨. 중분류(그룹)명·비메가 표기 금지.
 * REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: city≠group · country leaf — manifest
 */
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import {
  megaMenuClickLabelForCityKey,
  megaMenuClickLabelForCountryKey,
} from '@/lib/mega-menu-click-label'

const cityLeafLabels = new Set<string>()
const countryLeafLabels = new Set<string>()
const groupOnlyLabels = new Set<string>()

/** 관용 → 메가메뉴 leaf (도시↔도시·국가↔국가만. 시드니→호주 같은 강등 금지 — 카드 short 오염). */
const MEGA_DEST_ALIASES: Record<string, string> = {
  동경: '도쿄',
  상하이: '상해',
  베이징: '북경',
  칭다오: '청도',
  큐슈: '규슈', // still group — align will coerce via cityKey
  옌타이: '연태',
  울란바토르: '울란바타르',
  마쓰야마: '마츠야마',
  터키: '튀르키예', // group — align via cityKey(istanbul)→이스탄불
  뉴질랜드: '호주/뉴질랜드',
  호주: '호주/뉴질랜드',
}

/** LC-only 권역 — dest heal 시에만 도시명→국가 leaf (카드 short는 제목 도시명 유지). */
const MEGA_DEST_CITY_TO_COUNTRY_LEAF: Record<string, string> = {
  시드니: '호주/뉴질랜드',
  멜버른: '호주/뉴질랜드',
  오클랜드: '호주/뉴질랜드',
  파리: '프랑스',
  니스: '프랑스',
  보르도: '프랑스',
}

function ensureLeafIndex(): void {
  if (cityLeafLabels.size) return
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const g of tab.groups) {
      groupOnlyLabels.add(g.countryLabel)
      for (const leaf of g.cities) {
        if (leaf.kind === 'city') cityLeafLabels.add(leaf.label)
        else countryLeafLabels.add(leaf.label)
      }
    }
  }
}

/** 관용 표기를 메가메뉴 leaf/그룹 정규 라벨로. */
export function normalizeMegaMenuDestinationAlias(dest: string | null | undefined): string {
  const d = String(dest ?? '').trim()
  if (!d) return ''
  return MEGA_DEST_ALIASES[d] ?? d
}

export type MegaMenuDestKind = 'city' | 'country' | 'group' | 'other' | 'empty'

export function classifyMegaMenuDestinationLabel(dest: string | null | undefined): MegaMenuDestKind {
  ensureLeafIndex()
  const d = normalizeMegaMenuDestinationAlias(dest)
  if (!d) return 'empty'
  if (cityLeafLabels.has(d)) return 'city'
  if (countryLeafLabels.has(d)) return 'country'
  if (groupOnlyLabels.has(d) && !cityLeafLabels.has(d) && !countryLeafLabels.has(d)) return 'group'
  return 'other'
}

/** 문장에서 메가메뉴 city leaf → country leaf → alias 순으로 첫 매칭. */
export function firstMegaMenuLeafInText(text: string): string | null {
  ensureLeafIndex()
  const t = String(text ?? '')
  if (!t.trim()) return null
  const cityLabels = [...cityLeafLabels].sort((a, b) => b.length - a.length)
  for (const lab of cityLabels) {
    if (t.includes(lab)) return lab
  }
  const aliasKeys = Object.keys(MEGA_DEST_ALIASES).sort((a, b) => b.length - a.length)
  for (const from of aliasKeys) {
    if (!t.includes(from)) continue
    const to = MEGA_DEST_ALIASES[from]!
    const k = classifyMegaMenuDestinationLabel(to)
    if (k === 'city' || k === 'country') return to
  }
  const countryLabels = [...countryLeafLabels].sort((a, b) => b.length - a.length)
  for (const lab of countryLabels) {
    if (t.includes(lab)) return lab
  }
  return null
}

/** haystack에 leaf 라벨이 지명으로 등장하는지 (과매칭 완화). */
export function megaMenuLeafMentionedInHaystack(leaf: string, haystack: string): boolean {
  const h = String(haystack ?? '')
  const leafT = leaf.trim()
  if (!leafT || !h) return false
  if (h.includes(leafT)) return true
  // 호주/뉴질랜드 ← 호주|뉴질랜드
  if (leafT.includes('/')) {
    return leafT.split('/').some((p) => p.trim() && h.includes(p.trim()))
  }
  return false
}

/**
 * cityKey(도시 leaf 우선) → countryKey(국가 leaf) 순으로 메가메뉴 라벨.
 * 그룹명(홋카이도·규슈·미서부)은 반환하지 않음.
 */
export function megaMenuLeafLabelForProductGeo(args: {
  cityKey?: string | null
  countryKey?: string | null
}): string {
  const city = megaMenuClickLabelForCityKey(args.cityKey)
  if (city) return city
  return megaMenuClickLabelForCountryKey(args.countryKey) || ''
}

/**
 * 현재 dest가 메가메뉴 leaf가 아니면 geo 키 기준 leaf로 교체.
 * cityKey→leaf가 제목/기존 dest에 안 보이면 countryKey만 시도 (오매칭 cityKey 방지).
 */
export function alignDestinationToMegaMenuLeaf(input: {
  current?: string | null
  title?: string | null
  cityKey?: string | null
  countryKey?: string | null
}): { destination: string | null; reason: string } {
  ensureLeafIndex()
  const rawCurrent = String(input.current ?? '').trim()
  const current = normalizeMegaMenuDestinationAlias(rawCurrent)
  const kind = classifyMegaMenuDestinationLabel(current)
  if (kind === 'city' || kind === 'country') {
    if (current !== rawCurrent) {
      return { destination: current, reason: 'alias→mega_leaf' }
    }
    return { destination: current, reason: 'already_mega_leaf' }
  }

  const hay = [input.title, current, rawCurrent].filter(Boolean).join(' ')

  // 복합 dest「도쿄, 요코하마」「니스 · …」→ 문장 안 첫 메가 leaf (도시 우선)
  if (kind === 'other' || kind === 'empty') {
    const fromText = firstMegaMenuLeafInText(rawCurrent) || firstMegaMenuLeafInText(hay)
    if (fromText) {
      return { destination: fromText, reason: 'text→mega_leaf' }
    }
    // LC-only: 시드니·파리 등 도시 leaf 없음 → 국가 leaf로 dest 정합
    for (const [cityName, countryLeaf] of Object.entries(MEGA_DEST_CITY_TO_COUNTRY_LEAF)) {
      if (rawCurrent.includes(cityName) || hay.includes(cityName)) {
        return { destination: countryLeaf, reason: 'lc_city→country_leaf' }
      }
    }
  }

  const fromCity = megaMenuClickLabelForCityKey(input.cityKey)
  if (fromCity) {
    const cityKind = classifyMegaMenuDestinationLabel(fromCity)
    // 그룹 dest·오염 dest는 city leaf가 haystack에 있을 때만 (오매칭 cityKey 차단)
    if (kind === 'group' || kind === 'other' || kind === 'empty') {
      if (cityKind === 'city' && (kind === 'group' || megaMenuLeafMentionedInHaystack(fromCity, hay))) {
        return { destination: fromCity, reason: 'cityKey→mega_city_leaf' }
      }
      // 유럽 등 국가 leaf만 있는 권역 — cityKey가 국가 코드/슬러그로 국가 leaf를 가리킴
      if (cityKind === 'country' && megaMenuLeafMentionedInHaystack(fromCity, hay)) {
        return { destination: fromCity, reason: 'cityKey→mega_country_leaf' }
      }
    }
  }

  const fromCountry = megaMenuClickLabelForCountryKey(input.countryKey)
  if (fromCountry && megaMenuLeafMentionedInHaystack(fromCountry, hay)) {
    return { destination: fromCountry, reason: 'countryKey→mega_country_leaf' }
  }

  // 그룹명만 있고 city leaf를 haystack에서 못 찾으면 — cityKey city leaf라도 그룹 교정은 허용
  // (홋카이도→삿포로/오타루: 제목에 도시명이 없을 수 있음)
  if (kind === 'group' && fromCity && classifyMegaMenuDestinationLabel(fromCity) === 'city') {
    return { destination: fromCity, reason: 'group→cityKey_city_leaf' }
  }

  // alias만 그룹으로 정규화된 경우(큐슈→규슈) — 위 group 분기와 동일 처리 후에도 남으면 unchanged
  return { destination: current || null, reason: 'unchanged' }
}
