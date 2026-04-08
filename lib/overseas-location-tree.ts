/**
 * 해외 목적지 SSOT — 하나투어·모두투어 권역 분류 통합.
 * @see lib/overseas-location-tree.data.ts 트리 본문
 */
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import type {
  OverseasCountryNode,
  OverseasLeafNode,
  OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree.types'

export type { OverseasCountryNode, OverseasLeafNode, OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

export const OVERSEAS_LOCATION_TREE: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_DATA

export const OVERSEAS_LOCATION_TREE_CLEAN: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE.map((g) => ({
  ...g,
  countries: g.countries.filter((c) => c.children.length > 0),
}))

function addToken(set: Set<string>, s?: string) {
  if (s && s.trim()) set.add(s.trim())
}

/** 리프(도시·권역·루트·테마) 매칭 토큰 */
export function matchTokensForLeaf(_country: OverseasCountryNode, leaf: OverseasLeafNode): string[] {
  const set = new Set<string>()
  addToken(set, leaf.nodeLabel)
  leaf.aliases?.forEach((x) => addToken(set, x))
  leaf.supplierKeywords?.forEach((x) => addToken(set, x))
  leaf.supplierOnlyLabels?.forEach((x) => addToken(set, x))
  return [...set]
}

/** 국가(또는 일본 간토 등 세부 권역) 전체 선택 시 */
export function matchTokensForCountry(country: OverseasCountryNode): string[] {
  const set = new Set<string>()
  addToken(set, country.countryLabel)
  country.aliases?.forEach((x) => addToken(set, x))
  country.supplierKeywords?.forEach((x) => addToken(set, x))
  for (const leaf of country.children) {
    matchTokensForLeaf(country, leaf).forEach((t) => set.add(t))
  }
  return [...set]
}

/** @deprecated `matchTokensForCountry` 와 동일 */
export const matchTokensForCountryWhole = matchTokensForCountry

/** 상위 권역 그룹 전체 */
export function matchTokensForGroup(group: OverseasRegionGroupNode): string[] {
  const set = new Set<string>()
  addToken(set, group.groupLabel)
  group.aliases?.forEach((x) => addToken(set, x))
  for (const c of group.countries) {
    matchTokensForCountry(c).forEach((t) => set.add(t))
  }
  return [...set]
}

/** 국가 노드 라벨·aliases만 (하위 leaf 토큰 제외) — 상품→트리 역매칭 시 leaf 다음 단계용 */
export function matchTokensForCountryShallow(country: OverseasCountryNode): string[] {
  const set = new Set<string>()
  addToken(set, country.countryLabel)
  country.aliases?.forEach((x) => addToken(set, x))
  country.supplierKeywords?.forEach((x) => addToken(set, x))
  return [...set]
}

/** 권역 그룹 라벨·aliases만 (하위 국가 제외) */
export function matchTokensForGroupShallow(group: OverseasRegionGroupNode): string[] {
  const set = new Set<string>()
  addToken(set, group.groupLabel)
  group.aliases?.forEach((x) => addToken(set, x))
  return [...set]
}

export function productTitleMatchesTerms(title: string, terms: string[]): boolean {
  if (terms.length === 0) return true
  const t = title.toLowerCase()
  return terms.some((k) => t.includes(k.toLowerCase()))
}

export function findGroupInTree(groupKey: string): OverseasRegionGroupNode | undefined {
  return OVERSEAS_LOCATION_TREE_CLEAN.find((g) => g.groupKey === groupKey)
}

export function findCountryInTree(
  groupKey: string,
  countryKey: string
): { group: OverseasRegionGroupNode; country: OverseasCountryNode } | undefined {
  const group = findGroupInTree(groupKey)
  const country = group?.countries.find((c) => c.countryKey === countryKey)
  if (!group || !country) return undefined
  return { group, country }
}

export function findLeafInTree(
  groupKey: string,
  countryKey: string,
  leafKey: string
):
  | { group: OverseasRegionGroupNode; country: OverseasCountryNode; leaf: OverseasLeafNode }
  | undefined {
  const found = findCountryInTree(groupKey, countryKey)
  if (!found) return undefined
  const leaf = found.country.children.find((l) => l.nodeKey === leafKey)
  if (!leaf) return undefined
  return { ...found, leaf }
}

/** @deprecated `findCountryInTree` + `group` 키 사용 */
export function findCountryInTreeLegacy(
  continentKey: string,
  countryKey: string
): { continent: OverseasRegionGroupNode; country: OverseasCountryNode } | undefined {
  const r = findCountryInTree(continentKey, countryKey)
  if (!r) return undefined
  return { continent: r.group, country: r.country }
}

/** @deprecated `findLeafInTree` 사용 */
export function findCityInTree(
  continentKey: string,
  countryKey: string,
  cityKey: string
):
  | { continent: OverseasRegionGroupNode; country: OverseasCountryNode; city: OverseasLeafNode }
  | undefined {
  const r = findLeafInTree(continentKey, countryKey, cityKey)
  if (!r) return undefined
  return { continent: r.group, country: r.country, city: r.leaf }
}

/** @deprecated `matchTokensForLeaf` */
export function matchTokensForCity(country: OverseasCountryNode, city: OverseasLeafNode): string[] {
  return matchTokensForLeaf(country, city)
}
