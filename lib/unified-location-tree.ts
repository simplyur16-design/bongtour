/**
 * 해외 목적지 통합 SSOT — 매칭 트리(`overseas-location-tree.data`) 기반으로
 * 메가메뉴 권역·URL 슬러그·(선택) 통합 노드 뷰를 생성한다.
 */
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import type {
  OverseasCountryNode,
  OverseasLeafNode,
  OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree.types'

// ---- Mega menu types (이 파일이 SSOT — travel-landing-mega-menu-data 에서 re-export) ----

export type MegaMenuLeaf = {
  label: string
  terms: string[]
}

export type MegaMenuCountryGroup = {
  countryLabel: string
  cities: MegaMenuLeaf[]
}

export type MegaMenuSpecial = 'free' | 'supplier' | 'curation'

export type MegaMenuRegion = {
  id: string
  label: string
  hint?: string
  countryGroups?: MegaMenuCountryGroup[]
  special?: MegaMenuSpecial
}

/** 통합 트리 노드 — 확장·관리 UI·추후 DB 동기화용 */
export type UnifiedLocationNode = {
  id: string
  label: string
  type: 'continent' | 'region' | 'country' | 'city'
  children?: UnifiedLocationNode[]
  terms?: string[]
  megaMenuVisible?: boolean
  /** 레거시 browse 매칭 키 (상품 groupKey/countryKey/nodeKey 와 동일 체계) */
  matchGroupKey?: string
  matchCountryKey?: string
  matchNodeKey?: string
}

export const OVERSEAS_LOCATION_TREE_SOURCE: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_DATA

const CONTINENT_TABS: { id: string; label: string }[] = [
  { id: 'northeast-asia', label: '동북아' },
  { id: 'southeast-asia', label: '동남아' },
  { id: 'europe', label: '유럽' },
  { id: 'me-africa', label: '중동/아프리카' },
  { id: 'americas', label: '미주' },
  { id: 'oceania', label: '대양주' },
]

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

/** 유럽 블록 vs 중동·아프리카 블록 분리 (공급사 `europe-me-africa` 그룹 내부) */
function continentIdForLegacyCountry(groupKey: string, countryKey: string): string {
  if (groupKey === 'japan' || groupKey === 'china-circle') return 'northeast-asia'
  if (groupKey === 'sea-taiwan-south-asia') return 'southeast-asia'
  if (groupKey === 'guam-au-nz') return 'oceania'
  if (groupKey === 'americas') return 'americas'
  if (groupKey === 'europe-me-africa') {
    if (!countryKey) return 'europe'
    const meAfrica = new Set([
      'middle-east',
      'africa',
      'morocco',
      'caucasus',
    ])
    if (meAfrica.has(countryKey)) return 'me-africa'
    return 'europe'
  }
  return 'oceania'
}

/**
 * 레거시 매칭 트리를 6개 대륙 탭 메가메뉴로 변환.
 * 국가 라벨이 동일하면 같은 헤더 아래 도시만 합친다.
 */
export function buildGeographicMegaMenuRegions(): MegaMenuRegion[] {
  type Bucket = Map<string, MegaMenuCountryGroup>
  const byContinent = new Map<string, Bucket>()
  for (const c of CONTINENT_TABS) {
    byContinent.set(c.id, new Map())
  }

  for (const group of OVERSEAS_LOCATION_TREE_DATA) {
    for (const country of group.countries) {
      const contId = continentIdForLegacyCountry(group.groupKey, country.countryKey)
      const bucket = byContinent.get(contId)
      if (!bucket) continue

      const label = country.countryLabel
      let cg = bucket.get(label)
      if (!cg) {
        cg = { countryLabel: label, cities: [] }
        bucket.set(label, cg)
      }
      for (const leaf of country.children) {
        cg.cities.push({
          label: leaf.nodeLabel,
          terms: collectLeafTerms(country, leaf),
        })
      }
    }
  }

  return CONTINENT_TABS.map((tab) => {
    const bucket = byContinent.get(tab.id)!
    return {
      id: tab.id,
      label: tab.label,
      countryGroups: [...bucket.values()].filter((g) => g.cities.length > 0),
    }
  })
}

/** 테마·크루즈·지방출발 등 — 매칭 트리와 별도 유지 */
export const OVERSEAS_MEGA_MENU_THEME_REGIONS: MegaMenuRegion[] = [
  {
    id: 'cruise',
    label: '크루즈',
    countryGroups: [
      {
        countryLabel: '지중해·북유럽',
        cities: [
          { label: '지중해', terms: ['지중해', 'Mediterranean', '크루즈'] },
          { label: '북유럽', terms: ['북유럽', '크루즈', '노르웨이'] },
        ],
      },
      {
        countryLabel: '알래스카·캐리비안',
        cities: [
          { label: '알래스카', terms: ['알래스카', 'Alaska', '크루즈'] },
          { label: '캐리비안', terms: ['캐리비안', 'Caribbean', '크루즈'] },
        ],
      },
      {
        countryLabel: '동아시아',
        cities: [
          { label: '일본', terms: ['일본', '크루즈'] },
          { label: '동남아', terms: ['동남아', '싱가포르', '크루즈'] },
        ],
      },
    ],
  },
  {
    id: 'local_dep',
    label: '지방출발',
    countryGroups: [
      {
        countryLabel: '국내 출발지',
        cities: [
          { label: '부산', terms: ['부산', '출발'] },
          { label: '대구', terms: ['대구', '출발'] },
          { label: '광주', terms: ['광주', '출발'] },
          { label: '제주', terms: ['제주', '출발'] },
          { label: '청주', terms: ['청주', '출발'] },
        ],
      },
    ],
  },
  {
    id: 'golf_theme',
    label: '골프',
    countryGroups: [
      {
        countryLabel: '골프 인기',
        cities: [
          { label: '하와이', terms: ['하와이', '골프', 'Hawaii'] },
          { label: '괌', terms: ['괌', '골프', 'Guam'] },
          { label: '일본', terms: ['일본', '골프'] },
          { label: '태국', terms: ['태국', '골프', '치앙마이'] },
          { label: '필리핀', terms: ['필리핀', '골프', '세부'] },
        ],
      },
    ],
  },
  {
    id: 'honeymoon',
    label: '허니문',
    countryGroups: [
      {
        countryLabel: '허니문 인기',
        cities: [
          { label: '발리', terms: ['발리', 'Bali', '허니문'] },
          { label: '몰디브', terms: ['몰디브', 'Maldives', '허니문'] },
          { label: '하와이', terms: ['하와이', 'Hawaii', '허니문'] },
          { label: '괌', terms: ['괌', 'Guam', '허니문'] },
          { label: '싱가포르', terms: ['싱가포르', 'Singapore', '허니문'] },
        ],
      },
    ],
  },
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
  return [...buildGeographicMegaMenuRegions(), ...OVERSEAS_MEGA_MENU_THEME_REGIONS]
}

/** 메가메뉴에 노출되는 권역만 (테마 중 special 만 제외한 나머지 + 지리 탭) */
export function topNavMegaRegionsFiltered(regions: MegaMenuRegion[]): MegaMenuRegion[] {
  return regions.filter((r) => !r.special && r.countryGroups?.length)
}

/**
 * 6개 대륙 + 매칭 그룹을 합친 통합 뷰(플랫하지 않음) — 확장·문서용.
 */
/** `matchProductToOverseasNode` 결과 → browse `continent` 쿼리 슬러그 */
export function continentTabIdForMatch(groupKey: string, countryKey: string | undefined): string {
  return continentIdForLegacyCountry(groupKey, countryKey ?? '')
}

export function buildUnifiedLocationRoot(): UnifiedLocationNode[] {
  const continents: UnifiedLocationNode[] = CONTINENT_TABS.map((c) => ({
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
