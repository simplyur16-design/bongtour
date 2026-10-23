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
/** 테마여행 탭 그룹 — dest 교정에 쓰지 않음 (시즈오카↛트레킹) */
const sportsThemeGroupLabels = new Set<string>()
/** 그룹 라벨 → 그 그룹 직속 city/country leaf 라벨 */
const groupChildLeaves = new Map<string, Set<string>>()
/** leaf 라벨 → 소속 그룹 라벨들 */
const leafToGroups = new Map<string, Set<string>>()

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
  // 북유럽 다국가 — 그룹명 LC 중복 없이 발트3국 leaf로
  발틱: '발트3국',
  발틱3국: '발트3국',
  발트: '발트3국',
}

/**
 * LC 국가 leaf만 있는 권역의 수도·관용 도시 → 국가 leaf.
 * 같은 권역에 city leaf를 새로 만들지 않음 (코펜하겐≠덴마크 city 중복 금지).
 */
const MEGA_DEST_CITY_TO_COUNTRY_LEAF: Record<string, string> = {
  시드니: '호주/뉴질랜드',
  멜버른: '호주/뉴질랜드',
  오클랜드: '호주/뉴질랜드',
  파리: '프랑스',
  니스: '프랑스',
  보르도: '프랑스',
  코펜하겐: '덴마크',
  오슬로: '노르웨이',
  베르겐: '노르웨이',
  스톡홀름: '스웨덴',
  헬싱키: '핀란드',
  레이캬비크: '아이슬란드',
  탈린: '에스토니아',
  리가: '라트비아',
  빌뉴스: '리투아니아',
}

function ensureLeafIndex(): void {
  if (cityLeafLabels.size) return
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    const isSports = tab.id === 'sports_theme'
    for (const g of tab.groups) {
      groupOnlyLabels.add(g.countryLabel)
      if (isSports) sportsThemeGroupLabels.add(g.countryLabel)
      const children = groupChildLeaves.get(g.countryLabel) ?? new Set<string>()
      for (const leaf of g.cities) {
        if (leaf.kind === 'city') cityLeafLabels.add(leaf.label)
        else countryLeafLabels.add(leaf.label)
        children.add(leaf.label)
        const gs = leafToGroups.get(leaf.label) ?? new Set<string>()
        gs.add(g.countryLabel)
        leafToGroups.set(leaf.label, gs)
      }
      groupChildLeaves.set(g.countryLabel, children)
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

/** leaf가 해당 중분류 그룹의 직속 city/country인지. */
export function megaMenuLeafBelongsToGroup(leaf: string, groupLabel: string): boolean {
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  return Boolean(kids?.has(leaf))
}

/** 문장에 등장하는 첫 메가메뉴 중분류 그룹명 (긴 라벨 우선). */
export function firstMegaMenuGroupInText(text: string): string | null {
  ensureLeafIndex()
  const t = String(text ?? '')
  if (!t.trim()) return null
  const groups = [...groupOnlyLabels].sort((a, b) => b.length - a.length)
  for (const g of groups) {
    if (t.includes(g)) return g
  }
  return null
}

/** 그룹 직속 city leaf 중 문장에 라벨이 나온 첫 도시 (국가 leaf 제외). */
export function firstMegaMenuCityLeafInGroupFromText(
  groupLabel: string,
  text: string,
): string | null {
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  if (!kids?.size) return null
  const t = String(text ?? '')
  if (!t.trim()) return null
  const cities = [...kids]
    .filter((l) => cityLeafLabels.has(l))
    .sort((a, b) => b.length - a.length)
  for (const lab of cities) {
    if (t.includes(lab)) return lab
  }
  return null
}

/** 그룹 직속 leaf 중 문장에 라벨이 나온 첫 city → country. */
export function firstMegaMenuLeafInGroupFromText(groupLabel: string, text: string): string | null {
  const city = firstMegaMenuCityLeafInGroupFromText(groupLabel, text)
  if (city) return city
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  if (!kids?.size) return null
  const t = String(text ?? '')
  if (!t.trim()) return null
  const countries = [...kids]
    .filter((l) => countryLeafLabels.has(l))
    .sort((a, b) => b.length - a.length)
  for (const lab of countries) {
    // 그룹명===국가 leaf(인도)일 때는 제목에 그룹/국가명이 있을 때만
    if (t.includes(lab)) return lab
  }
  return null
}

/** 그룹에 국가 leaf가 있으면(인도·스리랑카) 그 라벨 — 권역 스케일 dest용. */
export function megaMenuCountryLeafInGroup(groupLabel: string): string | null {
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  if (!kids) return null
  for (const lab of kids) {
    if (countryLeafLabels.has(lab)) return lab
  }
  return null
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

function resolveWithinGroup(
  groupLabel: string,
  hay: string,
  cityKey: string | null | undefined,
): { destination: string; reason: string } | null {
  ensureLeafIndex()
  if (sportsThemeGroupLabels.has(groupLabel)) return null
  // 제목에 같은 그룹 도시 leaf가 있으면 그것 (미동부+뉴욕) — 대표 도시 short SSOT
  const fromTitleCity = firstMegaMenuCityLeafInGroupFromText(groupLabel, hay)
  if (fromTitleCity) {
    return { destination: fromTitleCity, reason: 'group→title_leaf_in_group' }
  }
  const fromTitle = firstMegaMenuLeafInGroupFromText(groupLabel, hay)
  if (fromTitle && classifyMegaMenuDestinationLabel(fromTitle) === 'country') {
    return { destination: fromTitle, reason: 'group→title_leaf_in_group' }
  }
  // 수도·관용 도시(코펜하겐) → 같은 그룹 국가 leaf (city leaf 중복 생성 없이)
  const softCityKeys = Object.keys(MEGA_DEST_CITY_TO_COUNTRY_LEAF).sort((a, b) => b.length - a.length)
  for (const cityName of softCityKeys) {
    if (!hay.includes(cityName)) continue
    const countryLeaf = MEGA_DEST_CITY_TO_COUNTRY_LEAF[cityName]!
    if (megaMenuLeafBelongsToGroup(countryLeaf, groupLabel)) {
      return { destination: countryLeaf, reason: 'group→soft_city_country' }
    }
  }
  // 인도·스리랑카만: 그룹명===국가 leaf 라벨일 때 권역=국가 (북유럽→덴마크 금지)
  const countryInGroup = megaMenuCountryLeafInGroup(groupLabel)
  if (countryInGroup === groupLabel && hay.includes(groupLabel)) {
    return { destination: countryInGroup, reason: 'group→country_leaf_in_group' }
  }
  const fromCity = megaMenuClickLabelForCityKey(cityKey)
  if (
    fromCity &&
    classifyMegaMenuDestinationLabel(fromCity) === 'city' &&
    megaMenuLeafBelongsToGroup(fromCity, groupLabel)
  ) {
    return { destination: fromCity, reason: 'group→cityKey_same_group' }
  }
  // 제목에 그룹명만 있고 cityKey가 타 그룹(미동부+niagara)이면 메뉴 첫 도시 leaf
  // — 다국가 그룹(북유럽)은 임의 국가 leaf로 떨어뜨리지 않음
  if (hay.includes(groupLabel)) {
    const kids = groupChildLeaves.get(groupLabel)
    if (kids) {
      const cityKids = [...kids].filter((l) => cityLeafLabels.has(l))
      if (cityKids.length) {
        return { destination: cityKids[0]!, reason: 'group→first_city_in_group' }
      }
      // 국가 leaf만 있는 그룹: 그룹명과 같은 LC만 (인도). 북유럽 등은 unchanged
      if (countryInGroup === groupLabel) {
        return { destination: countryInGroup, reason: 'group→country_leaf_in_group' }
      }
    }
  }
  return null
}

/**
 * 현재 dest가 메가메뉴 leaf가 아니면 geo 키 기준 leaf로 교체.
 * cityKey→leaf가 제목/기존 dest에 안 보이면 countryKey만 시도 (오매칭 cityKey 방지).
 * 그룹 dest는 같은 그룹 leaf만 허용 (미동부↛나이아가라/캐나다).
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
  const hay = [input.title, current, rawCurrent].filter(Boolean).join(' ')

  // 이미 city leaf인데 제목의 중분류 그룹과 소속이 다르면 교정
  // (나이아가라 ← 미동부 상품). 중국권·홍콩·마카오처럼 그룹이 여러 개면 오염 제목으로 보고 스킵.
  if (kind === 'city') {
    const titleOnly = String(input.title ?? '')
    // 제목에 그룹이 여러 개(미동부, 캐나다)여도 — 현재 city가 제목에 없고
    // 제목에서 더 앞에 나온 그룹에 속하지 않으면 그 그룹으로 교정 (나이아가라 잔존 금지)
    const groupsInTitle = [...groupOnlyLabels]
      .filter((g) => titleOnly.includes(g) && !sportsThemeGroupLabels.has(g))
      .sort((a, b) => {
        const ia = titleOnly.indexOf(a)
        const ib = titleOnly.indexOf(b)
        if (ia !== ib) return ia - ib
        return b.length - a.length
      })
    const primaryGroup = groupsInTitle[0]
    const belongsToAnyTitleGroup = groupsInTitle.some((g) => megaMenuLeafBelongsToGroup(current, g))
    const mentionedInTitle = megaMenuLeafMentionedInHaystack(current, titleOnly)
    // 제목에 현재 도시 명시 → 유지 (나이아가라 방문)
    if (mentionedInTitle) {
      if (current !== rawCurrent) {
        return { destination: current, reason: 'alias→mega_leaf' }
      }
      return { destination: current, reason: 'already_mega_leaf' }
    }
    // 현재가 제목 첫 그룹 밖일 때만 cityKey로 끌어옴 (미동부+캐나다 · 나이아가라→nyc)
    // 콜롬보∈스리랑카처럼 이미 같은 그룹이면 cityKey로 국가 leaf 승격을 막지 않음
    if (primaryGroup && groupsInTitle.length <= 2 && !megaMenuLeafBelongsToGroup(current, primaryGroup)) {
      const fromCity = megaMenuClickLabelForCityKey(input.cityKey)
      if (
        fromCity &&
        classifyMegaMenuDestinationLabel(fromCity) === 'city' &&
        megaMenuLeafBelongsToGroup(fromCity, primaryGroup)
      ) {
        return { destination: fromCity, reason: 'group→cityKey_same_group' }
      }
    }
    // 제목의 같은 그룹 대표 도시 leaf 우선 (자이푸르 dest + 제목 바라나시 → 바라나시)
    // LC 국가 그룹(인도·스리랑카): 제목에 도시 없으면 국가 leaf로 승격
    for (const g of groupsInTitle) {
      const titleCity = firstMegaMenuCityLeafInGroupFromText(g, titleOnly)
      if (titleCity && titleCity !== current) {
        return { destination: titleCity, reason: 'city→title_city_in_group' }
      }
      const countryInGroup = megaMenuCountryLeafInGroup(g)
      if (countryInGroup === g && !titleCity && megaMenuLeafBelongsToGroup(current, g)) {
        return { destination: countryInGroup, reason: 'city→country_leaf_scale' }
      }
    }
    // 현재 city가 제목의 다른 그룹에 속하면 유지 (미서부+하와이 → 호놀룰루)
    if (belongsToAnyTitleGroup) {
      if (current !== rawCurrent) {
        return { destination: current, reason: 'alias→mega_leaf' }
      }
      return { destination: current, reason: 'already_mega_leaf' }
    }
    // 중국권·홍콩·마카오·몽골처럼 그룹≥3 오염 제목은 스킵.
    if (primaryGroup && groupsInTitle.length <= 2) {
      const fixed = resolveWithinGroup(primaryGroup, titleOnly, input.cityKey)
      if (fixed) return fixed
    }
    // 같은 그룹: 제목에 다른 도시 leaf가 있으면 그걸 대표 dest (바라나시)
    // 제목에 도시 없이 국가/그룹명만이면 국가 leaf (스리랑카 일주)
    const groups = leafToGroups.get(current)
    if (groups) {
      for (const g of groups) {
        const titleCityInGroup = firstMegaMenuCityLeafInGroupFromText(g, titleOnly)
        if (titleCityInGroup && titleCityInGroup !== current) {
          return { destination: titleCityInGroup, reason: 'city→title_city_in_group' }
        }
        const countryInGroup = megaMenuCountryLeafInGroup(g)
        if (!countryInGroup) continue
        const cityInTitle = megaMenuLeafMentionedInHaystack(current, titleOnly)
        if (
          !cityInTitle &&
          !titleCityInGroup &&
          (titleOnly.includes(g) || titleOnly.includes(countryInGroup))
        ) {
          return { destination: countryInGroup, reason: 'city→country_leaf_scale' }
        }
      }
    }
    if (current !== rawCurrent) {
      return { destination: current, reason: 'alias→mega_leaf' }
    }
    return { destination: current, reason: 'already_mega_leaf' }
  }

  if (kind === 'country') {
    if (current !== rawCurrent) {
      return { destination: current, reason: 'alias→mega_leaf' }
    }
    return { destination: current, reason: 'already_mega_leaf' }
  }

  // 그룹 dest — 같은 그룹 leaf만 (미동부→뉴욕/워싱턴, 캐나다↛나이아가라로 훔치지 않음)
  if (kind === 'group') {
    const fixed = resolveWithinGroup(current, hay, input.cityKey)
    if (fixed) return fixed
    // 그룹 교정 실패 시 타 그룹 cityKey로 떨어뜨리지 않음
    return { destination: current || null, reason: 'unchanged_group' }
  }

  // 복합 dest「도쿄, 요코하마」「니스 · …」→ 문장 안 첫 메가 leaf (도시 우선)
  if (kind === 'other' || kind === 'empty') {
    const groupInTitle = firstMegaMenuGroupInText(hay)
    if (groupInTitle) {
      const fixed = resolveWithinGroup(groupInTitle, hay, input.cityKey)
      if (fixed) return fixed
    }
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
    if (kind === 'other' || kind === 'empty') {
      if (cityKind === 'city' && megaMenuLeafMentionedInHaystack(fromCity, hay)) {
        return { destination: fromCity, reason: 'cityKey→mega_city_leaf' }
      }
      if (cityKind === 'country' && megaMenuLeafMentionedInHaystack(fromCity, hay)) {
        return { destination: fromCity, reason: 'cityKey→mega_country_leaf' }
      }
    }
  }

  const fromCountry = megaMenuClickLabelForCountryKey(input.countryKey)
  if (fromCountry && megaMenuLeafMentionedInHaystack(fromCountry, hay)) {
    return { destination: fromCountry, reason: 'countryKey→mega_country_leaf' }
  }

  return { destination: current || null, reason: 'unchanged' }
}
