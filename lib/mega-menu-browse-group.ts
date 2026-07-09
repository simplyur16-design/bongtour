/**
 * 메가메뉴 열(현·도·미서부 등) → browse `menuGroup` 쿼리 및 Prisma city/country 키.
 * REGRESSION-FREEZE[eastern-europe-menu-group-country-keys]: 동유럽 LC leaf countryKey 합집합 — manifest
 * REGRESSION-FREEZE[europe-western-eastern-exclusive]: 서유럽·동유럽·북유럽 menuGroup 상호 배제 — manifest
 */
import { resolveBrowseCityKeysForFilter, resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import {
  MEGA_MENU_TAB_DEFINITIONS,
  type MegaMenuCountryGroupDef,
  type MegaMenuLeafDef,
} from '@/lib/mega-menu-regions.data'

export function megaMenuGroupSlugFromLabel(countryLabel: string): string {
  return countrySlugFromLabel(countryLabel)
}

/** browse `menuGroup`·한글 열 라벨(서유럽 등) → canonical 영문 슬러그 */
export function normalizeMegaMenuGroupSlug(menuGroupSlug: string): string {
  return countrySlugFromLabel(menuGroupSlug.trim()).toLowerCase()
}

export function findMegaMenuGroup(
  regionId: string,
  menuGroupSlug: string,
): MegaMenuCountryGroupDef | null {
  const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === regionId)
  if (!tab) return null
  const norm = normalizeMegaMenuGroupSlug(menuGroupSlug)
  return tab.groups.find((g) => countrySlugFromLabel(g.countryLabel) === norm) ?? null
}

/** 메가메뉴 열 라벨 → browse `menuGroup` (일본·중국 현·도, 미서부, 스포츠 테마 등) */
export function appendMenuGroupParam(params: URLSearchParams, groupCountryLabel: string): void {
  const label = groupCountryLabel.trim()
  if (!label) return
  params.set('menuGroup', countrySlugFromLabel(label))
}

/** 그룹 내 도시 leaf → 마스터 cityKey (LC-only 그룹은 빈 배열) */
export function resolveMegaMenuGroupCityKeys(regionId: string, menuGroupSlug: string): string[] {
  const g = findMegaMenuGroup(regionId, menuGroupSlug)
  if (!g) return []
  const keys = new Set<string>()
  for (const leaf of g.cities) {
    if (leaf.kind !== 'city') continue
    const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
    for (const k of resolveBrowseCityKeysForFilter(slug)) keys.add(k)
  }
  return [...keys]
}

const REGION_MENU_GROUP_PSEUDO_SLUGS = new Set([
  'western-europe',
  'eastern-europe',
  'northern-europe',
  'southern-europe',
  '서유럽',
  '동유럽',
  '북유럽',
  '남유럽',
])

function isValidMasterCountryKeyForBrowse(k: string): boolean {
  const s = k.trim().toLowerCase()
  if (!s || REGION_MENU_GROUP_PSEUDO_SLUGS.has(s)) return false
  if (/[가-힣]/.test(s)) return false
  if (s === 'balkans') return false
  return /^[a-z0-9-]+$/.test(s)
}

function countryKeysFromMegaMenuCountryLeaf(leaf: MegaMenuLeafDef): string[] {
  const slug = countrySlugFromLabel(leaf.browseCountryLabel ?? leaf.label)
  const keys = new Set<string>()
  for (const k of resolveBrowseCountryParamToCountryKeySlugs(slug)) {
    if (isValidMasterCountryKeyForBrowse(k)) keys.add(k)
  }
  return [...keys]
}

function countryKeysFromMegaMenuGroupLeaves(g: MegaMenuCountryGroupDef): string[] {
  const countryLeaves = g.cities.filter((leaf) => leaf.kind === 'country')
  if (countryLeaves.length === 0) return []

  const keys = new Set<string>()
  for (const leaf of countryLeaves) {
    for (const k of countryKeysFromMegaMenuCountryLeaf(leaf)) keys.add(k)
  }
  return [...keys]
}

/** 도시 leaf가 없는 그룹(알래스카·홍콩 LC-only 등) — countryKey 슬러그 */
export function resolveMegaMenuGroupCountryKeySlugs(regionId: string, menuGroupSlug: string): string[] {
  const g = findMegaMenuGroup(regionId, menuGroupSlug)
  if (!g) return []

  const fromCountryLeaves = countryKeysFromMegaMenuGroupLeaves(g)
  if (fromCountryLeaves.length > 0) return fromCountryLeaves

  const cityKeys = resolveMegaMenuGroupCityKeys(regionId, menuGroupSlug)
  if (cityKeys.length > 0) return []
  return resolveBrowseCountryParamToCountryKeySlugs(countrySlugFromLabel(g.countryLabel))
}

/** browse `region`이 메가메뉴 열 슬러그(동유럽·서유럽 등)일 때 — 탭을 가로질러 countryKey 합집합 */
export function resolveMegaMenuMenuGroupSlugToCountryKeySlugs(menuGroupSlug: string): string[] {
  const norm = normalizeMegaMenuGroupSlug(menuGroupSlug)
  if (!norm) return []
  const keys = new Set<string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    for (const k of resolveMegaMenuGroupCountryKeySlugs(tab.id, norm)) keys.add(k)
  }
  return [...keys]
}

export const EUROPE_WESTERN_MENU_GROUP_SLUG = 'western-europe'
export const EUROPE_EASTERN_MENU_GROUP_SLUG = 'eastern-europe'
export const EUROPE_NORTHERN_MENU_GROUP_SLUG = 'northern-europe'

function europeMenuGroupCountryKeysForSlug(regionId: string, slug: string): string[] {
  return resolveMegaMenuGroupCountryKeySlugs(regionId, slug)
}

function europeMenuGroupExcludeCountryKeys(regionId: string, ...excludeSlugs: string[]): string[] {
  const exclude = new Set<string>()
  for (const slug of excludeSlugs) {
    for (const k of resolveMegaMenuGroupCountryKeySlugs(regionId, slug)) exclude.add(k)
  }
  return [...exclude]
}

/**
 * 유럽 서유럽·동유럽·북유럽 중분류 browse 필터.
 * 동유럽: 체코·헝가리 등 eastern countryTag만 있으면 노출(오스트리아 동반 3국 패키지 포함).
 * 서유럽·북유럽: 해당 권역 태그는 있되 타 권역 태그가 섞이면 제외.
 */
export function resolveMegaMenuEuropeMenuGroupExclusiveFilter(
  regionId: string,
  menuGroupSlug: string,
): { include: string[]; exclude: string[] } | null {
  if (regionId !== 'europe-me') return null
  const mg = normalizeMegaMenuGroupSlug(menuGroupSlug)
  if (mg === EUROPE_EASTERN_MENU_GROUP_SLUG) {
    return {
      include: europeMenuGroupCountryKeysForSlug(regionId, EUROPE_EASTERN_MENU_GROUP_SLUG),
      exclude: [],
    }
  }
  if (mg === EUROPE_WESTERN_MENU_GROUP_SLUG) {
    return {
      include: europeMenuGroupCountryKeysForSlug(regionId, EUROPE_WESTERN_MENU_GROUP_SLUG),
      exclude: europeMenuGroupExcludeCountryKeys(
        regionId,
        EUROPE_EASTERN_MENU_GROUP_SLUG,
        EUROPE_NORTHERN_MENU_GROUP_SLUG,
      ),
    }
  }
  if (mg === EUROPE_NORTHERN_MENU_GROUP_SLUG) {
    return {
      include: europeMenuGroupCountryKeysForSlug(regionId, EUROPE_NORTHERN_MENU_GROUP_SLUG),
      exclude: europeMenuGroupExcludeCountryKeys(
        regionId,
        EUROPE_EASTERN_MENU_GROUP_SLUG,
        EUROPE_WESTERN_MENU_GROUP_SLUG,
      ),
    }
  }
  return null
}
