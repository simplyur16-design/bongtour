/**
 * 해외 목적지 통합 SSOT — 매칭 트리(`overseas-location-tree.data`) + 메가메뉴(`mega-menu-regions.data`).
 */
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import {
  MEGA_MENU_TAB_DEFINITIONS,
  type MegaMenuCountryGroupDef,
} from '@/lib/mega-menu-regions.data'
import type {
  OverseasCountryNode,
  OverseasLeafNode,
  OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree.types'

// ---- Mega menu types (이 파일이 SSOT — travel-landing-mega-menu-data 에서 re-export) ----

export type MegaMenuLeaf = {
  label: string
  terms: string[]
  /** browse URL `country` 슬러그 — 트리 국가 라벨과 다를 때 */
  browseCountryLabel?: string
  sublabel?: string
}

export type MegaMenuCountryGroup = {
  countryLabel: string
  cities: MegaMenuLeaf[]
  nonLinkHeader?: boolean
}

export type MegaMenuSpecial = 'free' | 'supplier' | 'curation'

export type MegaMenuRegion = {
  id: string
  label: string
  hint?: string
  countryGroups?: MegaMenuCountryGroup[]
  special?: MegaMenuSpecial
}

export type UnifiedLocationNode = {
  id: string
  label: string
  type: 'continent' | 'region' | 'country' | 'city'
  children?: UnifiedLocationNode[]
  terms?: string[]
  megaMenuVisible?: boolean
  matchGroupKey?: string
  matchCountryKey?: string
  matchNodeKey?: string
}

export const OVERSEAS_LOCATION_TREE_SOURCE: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_DATA

function addTerm(set: Set<string>, s?: string | null) {
  if (s?.trim()) set.add(s.trim())
}

export function collectLeafTerms(country: OverseasCountryNode, leaf: OverseasLeafNode): string[] {
  const set = new Set<string>()
  addTerm(set, leaf.nodeLabel)
  leaf.aliases?.forEach((x) => addTerm(set, x))
  leaf.supplierKeywords?.forEach((x) => addTerm(set, x))
  leaf.supplierOnlyLabels?.forEach((x) => addTerm(set, x))
  addTerm(set, country.countryLabel)
  country.aliases?.forEach((x) => addTerm(set, x))
  country.supplierKeywords?.forEach((x) => addTerm(set, x))
  return [...set]
}

/** 매칭 트리 → 메가메뉴 browse `region` 탭 id */
function continentIdForLegacyCountry(groupKey: string, countryKey: string): string {
  if (groupKey === 'japan') return 'japan'
  if (groupKey === 'china-circle') return 'china-hk-mo'
  if (groupKey === 'sea-taiwan-south-asia') return 'southeast-asia'
  if (groupKey === 'guam-au-nz') return 'oceania'
  if (groupKey === 'americas') return 'americas'
  if (groupKey === 'europe-me-africa') return 'europe-me'
  return 'oceania'
}

function groupDefToGroup(d: MegaMenuCountryGroupDef): MegaMenuCountryGroup {
  return {
    countryLabel: d.countryLabel,
    nonLinkHeader: d.nonLinkHeader,
    cities: d.cities.map(
      (c): MegaMenuLeaf => ({
        label: c.label,
        terms: c.terms,
        browseCountryLabel: c.browseCountryLabel,
      }),
    ),
  }
}

/** 메가메뉴 10탭 — `lib/mega-menu-regions.data.ts` SSOT */
export function buildMegaMenuRegionsFromDefinitions(): MegaMenuRegion[] {
  return MEGA_MENU_TAB_DEFINITIONS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    countryGroups: tab.groups.map(groupDefToGroup).filter((g) => g.cities.length > 0),
  }))
}

const MEGA_MENU_SPECIAL_TAIL: MegaMenuRegion[] = [
  {
    id: 'curation',
    label: '추천여행',
    hint: '운영에서 고른 이달 큐레이션 카드로 이동합니다.',
    special: 'curation',
  },
  {
    id: 'free',
    label: '자유여행',
    hint: '에어텔·항공+호텔 중심으로 보기',
    special: 'free',
  },
  {
    id: 'supplier',
    label: '공급사별',
    hint: '하나·모두·참좋은 등 출처별로 보기',
    special: 'supplier',
  },
]

export function buildOverseasMegaMenuRegionsWithThemes(): MegaMenuRegion[] {
  return [...buildMegaMenuRegionsFromDefinitions(), ...MEGA_MENU_SPECIAL_TAIL]
}

export function topNavMegaRegionsFiltered(regions: MegaMenuRegion[]): MegaMenuRegion[] {
  return regions.filter((r) => !r.special && r.countryGroups?.length)
}

export function continentTabIdForMatch(groupKey: string, countryKey: string | undefined): string {
  return continentIdForLegacyCountry(groupKey, countryKey ?? '')
}

export function buildUnifiedLocationRoot(): UnifiedLocationNode[] {
  const continents: UnifiedLocationNode[] = MEGA_MENU_TAB_DEFINITIONS.map((c) => ({
    id: c.id,
    label: c.label,
    type: 'continent',
    megaMenuVisible: true,
    children: [],
    terms: [],
  }))
  const contById = new Map(continents.map((x) => [x.id, x]))

  for (const group of OVERSEAS_LOCATION_TREE_DATA) {
    for (const country of group.countries) {
      const cid = continentIdForLegacyCountry(group.groupKey, country.countryKey)
      const cont = contById.get(cid)
      if (!cont?.children) continue

      let countryNode = cont.children.find((n) => n.id === `c:${cid}:${country.countryKey}`)
      if (!countryNode) {
        countryNode = {
          id: `c:${cid}:${country.countryKey}`,
          label: country.countryLabel,
          type: 'country',
          megaMenuVisible: true,
          matchGroupKey: group.groupKey,
          matchCountryKey: country.countryKey,
          children: [],
          terms: [...(country.aliases ?? []), country.countryLabel, ...(country.supplierKeywords ?? [])].filter(
            Boolean,
          ) as string[],
        }
        cont.children.push(countryNode)
      }

      for (const leaf of country.children) {
        const cityNode: UnifiedLocationNode = {
          id: `city:${group.groupKey}:${country.countryKey}:${leaf.nodeKey}`,
          label: leaf.nodeLabel,
          type: 'city',
          megaMenuVisible: true,
          matchGroupKey: group.groupKey,
          matchCountryKey: country.countryKey,
          matchNodeKey: leaf.nodeKey,
          terms: collectLeafTerms(country, leaf),
        }
        countryNode.children = countryNode.children ?? []
        countryNode.children.push(cityNode)
      }
    }
  }

  return continents
}
