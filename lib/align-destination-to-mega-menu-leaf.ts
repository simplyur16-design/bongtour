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
/** 테마여행 leaf(골프·트레킹…) — text→mega_leaf 금지 · 이미 dest여도 제목 geo로 재교정 */
const sportsThemeLeafLabels = new Set<string>()
/** 그룹 라벨 → 그 그룹 직속 city/country leaf 라벨 */
const groupChildLeaves = new Map<string, Set<string>>()
/** leaf 라벨 → 소속 그룹 라벨들 */
const leafToGroups = new Map<string, Set<string>>()
/** 고유 한글 term → leaf 라벨 (마사이마라→케냐, 마추픽추→페루). 모호 term은 제외 */
const uniqueHangulTermToLeaf = new Map<string, string>()

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
  // 메뉴 leaf 표기와 다른 관용 (등록대기 dest 오염 복구)
  계림: '구이린',
  싱가폴: '싱가포르',
  구채구: '성도',
  호이안: '다낭',
  옐로나이프: '옐로우나이프',
  바티칸: '이탈리아',
  오아후: '호놀룰루',
  와이키키: '호놀룰루',
  베르사유: '프랑스',
  퀸즐랜드: '호주/뉴질랜드',
  백두산: '장백산',
  선전: '심천',
}

/** 제목 관용 그룹명 → 메가 중분류 (북해도·남미) */
const MEGA_GROUP_ALIASES: Record<string, string> = {
  북해도: '홋카이도',
  남미: '중남미',
  발칸: '동유럽',
  발칸여행: '동유럽',
}

/** browse/오염 우산 dest — leaf가 아님, 제목·geo키로만 교정 */
const UMBRELLA_DEST_LABELS = new Set(['유럽', '미주', '아시아', '미지정', '지중해'])

/** term 인덱싱에서 제외 (다수 leaf 공유·너무 일반) */
const TERM_INDEX_NOISE = new Set([
  '중국',
  '일본',
  '미국',
  '베트남',
  '태국',
  '하와이',
  '캐나다',
  '규슈',
  '간토',
  '간사이',
  '홋카이도',
  '오키나와',
  '주고쿠',
  '시코쿠',
  '산동',
  '화동',
  '화북',
  '화중',
  '화남',
  '동북',
  '복건',
  '하남',
  '호북',
  '몽골',
  '사천',
  '미동부',
  '미서부',
  '미국동부',
  '미국서부',
  '로키',
])

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
  프라하: '체코',
  비엔나: '오스트리아',
  잘츠부르크: '오스트리아',
  로마: '이탈리아',
  밀라노: '이탈리아',
  베네치아: '이탈리아',
}

function ensureLeafIndex(): void {
  if (cityLeafLabels.size) return
  type LeafRef = { label: string; terms: string[]; sports: boolean }
  const allLeaves: LeafRef[] = []
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    const isSports = tab.id === 'sports_theme'
    for (const g of tab.groups) {
      groupOnlyLabels.add(g.countryLabel)
      if (isSports) sportsThemeGroupLabels.add(g.countryLabel)
      const children = groupChildLeaves.get(g.countryLabel) ?? new Set<string>()
      for (const leaf of g.cities) {
        if (isSports) sportsThemeLeafLabels.add(leaf.label)
        if (leaf.kind === 'city') cityLeafLabels.add(leaf.label)
        else countryLeafLabels.add(leaf.label)
        children.add(leaf.label)
        const gs = leafToGroups.get(leaf.label) ?? new Set<string>()
        gs.add(g.countryLabel)
        leafToGroups.set(leaf.label, gs)
        allLeaves.push({ label: leaf.label, terms: leaf.terms ?? [], sports: isSports })
      }
      groupChildLeaves.set(g.countryLabel, children)
    }
  }
  const termHits = new Map<string, Set<string>>()
  for (const leaf of allLeaves) {
    if (leaf.sports) continue
    for (const term of leaf.terms) {
      const t = String(term || '').trim()
      if (!t || t === leaf.label) continue
      // 한글(+공백) 지명 term만 — 빅토리아 폭포 포함
      if (!/^[가-힣]{2,}(?:\s+[가-힣]{2,})*$/u.test(t)) continue
      if (TERM_INDEX_NOISE.has(t) || groupOnlyLabels.has(t)) continue
      if (cityLeafLabels.has(t) || countryLeafLabels.has(t)) continue
      const set = termHits.get(t) ?? new Set<string>()
      set.add(leaf.label)
      termHits.set(t, set)
    }
  }
  for (const [term, leaves] of termHits) {
    if (leaves.size === 1) uniqueHangulTermToLeaf.set(term, [...leaves][0]!)
  }
}

/** 제목의 관용 그룹 표기를 메가 중분류로 펼침 (북해도→홋카이도). */
function expandGroupAliasesInText(text: string): string {
  let t = String(text ?? '')
  const keys = Object.keys(MEGA_GROUP_ALIASES).sort((a, b) => b.length - a.length)
  for (const from of keys) {
    if (!t.includes(from)) continue
    t = t.split(from).join(MEGA_GROUP_ALIASES[from]!)
  }
  return t
}

/** 테마여행 leaf인지 (골프·트레킹 dest 오적용 차단) */
export function isSportsThemeMegaMenuLeaf(dest: string | null | undefined): boolean {
  ensureLeafIndex()
  return sportsThemeLeafLabels.has(normalizeMegaMenuDestinationAlias(dest))
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
  const t = expandGroupAliasesInText(String(text ?? ''))
  if (!t.trim()) return null
  // 제목에서 더 앞에 나온 그룹 우선 (아프리카 & 남미 → 아프리카)
  const hits = [...groupOnlyLabels]
    .filter((g) => t.includes(g) && !sportsThemeGroupLabels.has(g))
    .sort((a, b) => {
      const ia = t.indexOf(a)
      const ib = t.indexOf(b)
      if (ia !== ib) return ia - ib
      return b.length - a.length
    })
  return hits[0] ?? null
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

/** 그룹 직속 leaf 중 문장에 라벨·고유 term이 나온 첫 city → country. */
export function firstMegaMenuLeafInGroupFromText(groupLabel: string, text: string): string | null {
  const city = firstMegaMenuCityLeafInGroupFromText(groupLabel, text)
  if (city) return city
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  if (!kids?.size) return null
  const t = expandGroupAliasesInText(String(text ?? ''))
  if (!t.trim()) return null
  // 권역 LC(중남미·아프리카)는 세부 국가·term보다 후순위 — 마추픽추→페루 우선
  const countries = [...kids]
    .filter((l) => countryLeafLabels.has(l) && l !== groupLabel)
    .sort((a, b) => b.length - a.length)
  for (const lab of countries) {
    if (t.includes(lab)) return lab
  }
  // 고유 term (마사이마라→케냐, 마추픽추→페루)
  const termKeys = [...uniqueHangulTermToLeaf.keys()].sort((a, b) => b.length - a.length)
  for (const term of termKeys) {
    if (!hangulPlaceTokenMentioned(t, term)) continue
    const leaf = uniqueHangulTermToLeaf.get(term)!
    if (kids.has(leaf) && leaf !== groupLabel) return leaf
  }
  if (countryLeafLabels.has(groupLabel) && t.includes(groupLabel)) return groupLabel
  return null
}

/** 그룹에 국가 leaf가 있으면(인도·스리랑카·아프리카) 그 라벨 — 권역 스케일 dest용. */
export function megaMenuCountryLeafInGroup(groupLabel: string): string | null {
  ensureLeafIndex()
  const kids = groupChildLeaves.get(groupLabel)
  if (!kids) return null
  // 그룹명===LC(인도·아프리카·중남미) 우선
  if (kids.has(groupLabel) && countryLeafLabels.has(groupLabel)) return groupLabel
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
    if (sportsThemeLeafLabels.has(lab)) continue
    // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 「두 개의 나라」≠나라시 — manifest
    if (hangulPlaceTokenMentioned(t, lab)) return lab
  }
  const aliasKeys = Object.keys(MEGA_DEST_ALIASES).sort((a, b) => b.length - a.length)
  for (const from of aliasKeys) {
    if (!hangulPlaceTokenMentioned(t, from)) continue
    const to = MEGA_DEST_ALIASES[from]!
    if (sportsThemeLeafLabels.has(to)) continue
    const k = classifyMegaMenuDestinationLabel(to)
    if (k === 'city' || k === 'country') return to
  }
  // LC soft 도시(프라하·로마) → 국가 leaf — 「유럽 (프라하 성)」 등
  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 니스≠비즈니스 부분일치 — manifest
  const softKeys = Object.keys(MEGA_DEST_CITY_TO_COUNTRY_LEAF).sort((a, b) => b.length - a.length)
  for (const cityName of softKeys) {
    if (!hangulPlaceTokenMentioned(t, cityName)) continue
    const countryLeaf = MEGA_DEST_CITY_TO_COUNTRY_LEAF[cityName]!
    if (!sportsThemeLeafLabels.has(countryLeaf)) return countryLeaf
  }
  const countryLabels = [...countryLeafLabels].sort((a, b) => b.length - a.length)
  for (const lab of countryLabels) {
    if (sportsThemeLeafLabels.has(lab)) continue
    if (hangulPlaceTokenMentioned(t, lab)) return lab
  }
  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 고유 term→leaf (마사이마라·마추픽추) — manifest
  const termKeys = [...uniqueHangulTermToLeaf.keys()].sort((a, b) => b.length - a.length)
  for (const term of termKeys) {
    if (!hangulPlaceTokenMentioned(t, term)) continue
    const leaf = uniqueHangulTermToLeaf.get(term)!
    if (sportsThemeLeafLabels.has(leaf)) continue
    return leaf
  }
  return null
}

/** 짧은 한글 토큰이 더 긴 단어(비즈니스⊃니스) 안에 끼지 않았는지. */
function hangulPlaceTokenMentioned(haystack: string, token: string): boolean {
  const h = String(haystack ?? '')
  const t = token.trim()
  if (!t || !h) return false
  // 「두 개의 나라」「여러 나라」= 국가(nation) 관용 — 일본 나라시 leaf 금지
  if (t === '나라' && /(?:개|몇|두|세|네|여러|모든|각|한)\s*의?\s*나라|나라\s*를\s*품/.test(h)) {
    return false
  }
  if (h.includes(t)) {
    if (t.length >= 3) return true
    const re = new RegExp(`(?<![가-힣])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![가-힣])`)
    return re.test(h)
  }
  // 「빅토리아 폭포」↔「빅토리아폭포」공백 무시 매칭
  const hCompact = h.replace(/\s+/g, '')
  const tCompact = t.replace(/\s+/g, '')
  if (tCompact.length >= 3 && hCompact.includes(tCompact)) return true
  return false
}

/** haystack에 leaf 라벨이 지명으로 등장하는지 (과매칭 완화). */
export function megaMenuLeafMentionedInHaystack(leaf: string, haystack: string): boolean {
  const h = String(haystack ?? '')
  const leafT = leaf.trim()
  if (!leafT || !h) return false
  if (hangulPlaceTokenMentioned(h, leafT)) return true
  // 호주/뉴질랜드 ← 호주|뉴질랜드
  if (leafT.includes('/')) {
    return leafT.split('/').some((p) => p.trim() && hangulPlaceTokenMentioned(h, p.trim()))
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
  countryKey?: string | null,
): { destination: string; reason: string } | null {
  ensureLeafIndex()
  if (sportsThemeGroupLabels.has(groupLabel)) return null
  const hayN = expandGroupAliasesInText(hay)
  // 제목에 같은 그룹 도시 leaf가 있으면 그것 (미동부+뉴욕) — 대표 도시 short SSOT
  const fromTitleCity = firstMegaMenuCityLeafInGroupFromText(groupLabel, hayN)
  if (fromTitleCity) {
    return { destination: fromTitleCity, reason: 'group→title_leaf_in_group' }
  }
  const fromTitle = firstMegaMenuLeafInGroupFromText(groupLabel, hayN)
  if (fromTitle && classifyMegaMenuDestinationLabel(fromTitle) === 'country') {
    return { destination: fromTitle, reason: 'group→title_leaf_in_group' }
  }
  // 수도·관용 도시(코펜하겐) → 같은 그룹 국가 leaf (city leaf 중복 생성 없이)
  const softCityKeys = Object.keys(MEGA_DEST_CITY_TO_COUNTRY_LEAF).sort((a, b) => b.length - a.length)
  for (const cityName of softCityKeys) {
    if (!hangulPlaceTokenMentioned(hayN, cityName)) continue
    const countryLeaf = MEGA_DEST_CITY_TO_COUNTRY_LEAF[cityName]!
    if (megaMenuLeafBelongsToGroup(countryLeaf, groupLabel)) {
      return { destination: countryLeaf, reason: 'group→soft_city_country' }
    }
  }
  // 인도·스리랑카만: 그룹명===국가 leaf 라벨일 때 권역=국가 (북유럽→덴마크 금지)
  const countryInGroup = megaMenuCountryLeafInGroup(groupLabel)
  if (countryInGroup === groupLabel && hayN.includes(groupLabel)) {
    return { destination: countryInGroup, reason: 'group→country_leaf_in_group' }
  }
  const fromCity = megaMenuClickLabelForCityKey(cityKey)
  if (fromCity && megaMenuLeafBelongsToGroup(fromCity, groupLabel)) {
    const ck = classifyMegaMenuDestinationLabel(fromCity)
    // cancun→멕시코(LC) · lima→페루 등 cityKey가 국가 leaf인 경우도 허용
    if (ck === 'city' || ck === 'country') {
      return { destination: fromCity, reason: 'group→cityKey_same_group' }
    }
  }
  const fromCountryKey = megaMenuClickLabelForCountryKey(countryKey)
  if (
    fromCountryKey &&
    classifyMegaMenuDestinationLabel(fromCountryKey) === 'country' &&
    megaMenuLeafBelongsToGroup(fromCountryKey, groupLabel)
  ) {
    return { destination: fromCountryKey, reason: 'group→countryKey_same_group' }
  }
  // 제목에 그룹명만 있고 cityKey가 타 그룹(미동부+niagara)이면 메뉴 첫 도시 leaf
  // — 다국가 그룹(북유럽)은 임의 국가 leaf로 떨어뜨리지 않음
  if (hayN.includes(groupLabel)) {
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
  let current = normalizeMegaMenuDestinationAlias(rawCurrent)
  // 우산 dest(유럽·미지정)는 leaf가 아님 — other로 취급해 제목·geo키 교정
  let kind = classifyMegaMenuDestinationLabel(current)
  if (UMBRELLA_DEST_LABELS.has(current) || UMBRELLA_DEST_LABELS.has(rawCurrent)) {
    kind = 'other'
  }
  const hay = expandGroupAliasesInText(
    [input.title, current, rawCurrent].filter(Boolean).join(' '),
  )

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
      const fixed = resolveWithinGroup(primaryGroup, titleOnly, input.cityKey, input.countryKey)
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
        // 고유 term이 현재 city를 가리키면 유지 (타지마할→아그라 등 — 국가 승격·진동 금지)
        const termKeepsCity = [...uniqueHangulTermToLeaf.entries()].some(
          ([term, leaf]) => leaf === current && hangulPlaceTokenMentioned(titleOnly, term),
        )
        if (
          !cityInTitle &&
          !titleCityInGroup &&
          !termKeepsCity &&
          (titleOnly.includes(g) || titleOnly.includes(countryInGroup))
        ) {
          // cityKey가 현재 도시를 가리키면 국가 승격 금지
          const fromCk = megaMenuClickLabelForCityKey(input.cityKey)
          if (fromCk === current) continue
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
    // 테마 leaf(골프·트레킹·2030)는 geo dest가 아님 — 제목·cityKey·countryKey로 권역 leaf 재교정
    if (sportsThemeLeafLabels.has(current)) {
      const groupInTitle = firstMegaMenuGroupInText(hay)
      if (groupInTitle && !sportsThemeGroupLabels.has(groupInTitle)) {
        const fixed = resolveWithinGroup(groupInTitle, hay, input.cityKey, input.countryKey)
        if (fixed) return fixed
      }
      const fromText = firstMegaMenuLeafInText(hay)
      if (fromText && !sportsThemeLeafLabels.has(fromText)) {
        return { destination: fromText, reason: 'sports→geo_leaf' }
      }
      for (const [cityName, countryLeaf] of Object.entries(MEGA_DEST_CITY_TO_COUNTRY_LEAF)) {
        if (hangulPlaceTokenMentioned(hay, cityName)) {
          return { destination: countryLeaf, reason: 'sports→lc_country_leaf' }
        }
      }
      // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 2030/골프 dest → cityKey 신뢰 — manifest
      const fromCity = megaMenuClickLabelForCityKey(input.cityKey)
      if (fromCity && !sportsThemeLeafLabels.has(fromCity)) {
        const ck = classifyMegaMenuDestinationLabel(fromCity)
        if (ck === 'city' || ck === 'country') {
          return { destination: fromCity, reason: 'sports→cityKey' }
        }
      }
      const fromCountry = megaMenuClickLabelForCountryKey(input.countryKey)
      if (fromCountry && !sportsThemeLeafLabels.has(fromCountry)) {
        return { destination: fromCountry, reason: 'sports→countryKey' }
      }
      return { destination: current, reason: 'unchanged_sports_theme' }
    }
    // 권역 LC(중남미·아프리카·인도) — 제목에 더 구체적 leaf가 있으면 승격
    // 단 「완전일주·골든트라이앵글·N개국」다도시 상품:
    //   · 도시 leaf로 쪼개지 않음
    //   · 서로 다른 국가 term이 2개 이상이면 권역 LC 유지 (마추픽추+이과수≠페루)
    //   · 국가 term이 1개면 그 국가 leaf 허용 (마사이마라→케냐)
    const scaleGroups = leafToGroups.get(current)
    if (scaleGroups?.has(current)) {
      const fromTitle = firstMegaMenuLeafInGroupFromText(current, hay)
      if (fromTitle && fromTitle !== current) {
        const multiCircuit = /완전\s*일주|골든\s*트라이앵글|\d+\s*개국/.test(hay)
        const toCity = classifyMegaMenuDestinationLabel(fromTitle) === 'city'
        if (multiCircuit && toCity) {
          // keep region LC
        } else if (multiCircuit) {
          const kids = groupChildLeaves.get(current)
          const hitLeaves = new Set<string>()
          for (const [term, leaf] of uniqueHangulTermToLeaf) {
            if (!kids?.has(leaf) || leaf === current) continue
            if (hangulPlaceTokenMentioned(hay, term)) hitLeaves.add(leaf)
          }
          if (kids) {
            for (const lab of kids) {
              if (lab === current || !countryLeafLabels.has(lab)) continue
              if (hay.includes(lab)) hitLeaves.add(lab)
            }
          }
          if (hitLeaves.size <= 1) {
            return { destination: fromTitle, reason: 'country_scale→title_leaf' }
          }
        } else {
          return { destination: fromTitle, reason: 'country_scale→title_leaf' }
        }
      }
    }
    if (current !== rawCurrent) {
      return { destination: current, reason: 'alias→mega_leaf' }
    }
    return { destination: current, reason: 'already_mega_leaf' }
  }

  // 그룹 dest — 같은 그룹 leaf만 (미동부→뉴욕/워싱턴, 캐나다↛나이아가라로 훔치지 않음)
  if (kind === 'group') {
    const fixed = resolveWithinGroup(current, hay, input.cityKey, input.countryKey)
    if (fixed) return fixed
    return { destination: current || null, reason: 'unchanged_group' }
  }

  // 복합 dest「도쿄, 요코하마」「니스 · …」·우산「유럽」→ 문장 안 첫 메가 leaf (도시 우선)
  if (kind === 'other' || kind === 'empty') {
    const groupInTitle = firstMegaMenuGroupInText(hay)
    if (groupInTitle) {
      const fixed = resolveWithinGroup(groupInTitle, hay, input.cityKey, input.countryKey)
      if (fixed) return fixed
    }
    const fromText = firstMegaMenuLeafInText(rawCurrent) || firstMegaMenuLeafInText(hay)
    if (fromText && !sportsThemeLeafLabels.has(fromText)) {
      return { destination: fromText, reason: 'text→mega_leaf' }
    }
    // LC-only: 시드니·파리 등 도시 leaf 없음 → 국가 leaf로 dest 정합
    for (const [cityName, countryLeaf] of Object.entries(MEGA_DEST_CITY_TO_COUNTRY_LEAF)) {
      if (
        hangulPlaceTokenMentioned(rawCurrent, cityName) ||
        hangulPlaceTokenMentioned(hay, cityName)
      ) {
        return { destination: countryLeaf, reason: 'lc_city→country_leaf' }
      }
    }
  }

  const fromCity = megaMenuClickLabelForCityKey(input.cityKey)
  if (fromCity) {
    const cityKind = classifyMegaMenuDestinationLabel(fromCity)
    if (kind === 'other' || kind === 'empty' || sportsThemeLeafLabels.has(current)) {
      if (cityKind === 'city' && megaMenuLeafMentionedInHaystack(fromCity, hay)) {
        return { destination: fromCity, reason: 'cityKey→mega_city_leaf' }
      }
      if (cityKind === 'city') {
        const groups = leafToGroups.get(fromCity)
        if (groups && [...groups].some((g) => hay.includes(g) && !sportsThemeGroupLabels.has(g))) {
          return { destination: fromCity, reason: 'cityKey→group_in_title' }
        }
      }
      // 우산 dest·오염 dest: cityKey가 있으면 제목 미언급이어도 신뢰 (okinawa-main→오키나와)
      if (
        (cityKind === 'city' || cityKind === 'country') &&
        (UMBRELLA_DEST_LABELS.has(rawCurrent) ||
          UMBRELLA_DEST_LABELS.has(current) ||
          kind === 'other' ||
          kind === 'empty')
      ) {
        return { destination: fromCity, reason: 'cityKey→trust_other_dest' }
      }
      if (cityKind === 'country' && megaMenuLeafMentionedInHaystack(fromCity, hay)) {
        return { destination: fromCity, reason: 'cityKey→mega_country_leaf' }
      }
    }
  }

  const fromCountry = megaMenuClickLabelForCountryKey(input.countryKey)
  if (fromCountry) {
    if (megaMenuLeafMentionedInHaystack(fromCountry, hay)) {
      return { destination: fromCountry, reason: 'countryKey→mega_country_leaf' }
    }
    // 유럽 우산 + countryKey=austria/hungary/switzerland
    const groups = leafToGroups.get(fromCountry)
    const groupInTitle = firstMegaMenuGroupInText(hay)
    if (
      groups &&
      (UMBRELLA_DEST_LABELS.has(rawCurrent) ||
        UMBRELLA_DEST_LABELS.has(current) ||
        (groupInTitle && groups.has(groupInTitle)))
    ) {
      return { destination: fromCountry, reason: 'countryKey→umbrella_or_group' }
    }
  }

  return { destination: current || null, reason: 'unchanged' }
}
