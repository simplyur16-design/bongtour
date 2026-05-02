/**
 * 해외 목적지 통합 SSOT — 매칭 트리(`overseas-location-tree.data`) 기반으로
 * 메가메뉴 권역·URL 슬러그·(선택) 통합 노드 뷰를 생성한다.
 */
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import {
  buildAmericasMegaMenuGroups,
  buildChinaHkMoMegaMenuGroups,
  buildEuropeMegaMenuGroups,
  buildJapanMegaMenuGroups,
  buildMeAfricaMegaMenuGroups,
  buildOceaniaMegaMenuGroups,
  buildSeaMegaMenuGroups,
  type MegaMenuCountryGroupInput,
} from '@/lib/mega-menu-geography'
import type {
  OverseasCountryNode,
  OverseasLeafNode,
  OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree.types'

// ---- Mega menu types (이 파일이 SSOT — travel-landing-mega-menu-data 에서 re-export) ----

export type MegaMenuLeaf = {
  label: string
  terms: string[]
  /** browse URL `country` 슬러그 — 트리 국가 라벨과 다를 때(권역 헤더 아래 나라 행) */
  browseCountryLabel?: string
  /** 보조 한 줄(골프장·기항지·노선 힌트 등) — URL·매칭 terms와 별도 */
  sublabel?: string
}

export type MegaMenuCountryGroup = {
  countryLabel: string
  cities: MegaMenuLeaf[]
  /** true면 헤더는 링크 없이 텍스트(서유럽 등) */
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

/** 메가메뉴 지리 탭 순서·라벨(10탭 중 지리 6개). `treeLabel`은 통합 트리용. */
const CONTINENT_TABS: { id: string; label: string; treeLabel?: string }[] = [
  { id: 'europe-me', label: '유럽/중동/아프리카', treeLabel: '유럽 · 중동 · 아프리카' },
  { id: 'southeast-asia', label: '동남아/대만/서남아', treeLabel: '동남아 · 대만 · 서남아' },
  { id: 'japan', label: '일본', treeLabel: '일본' },
  { id: 'china-hk-mo', label: '중국/홍콩/마카오/몽골', treeLabel: '중국 · 홍콩 · 마카오 · 몽골' },
  { id: 'oceania', label: '괌/사이판/호주/뉴질랜드', treeLabel: '괌 · 사이판 · 호주 · 뉴질랜드' },
  { id: 'americas', label: '미주/캐나다/하와이', treeLabel: '미주 · 캐나다 · 하와이' },
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

/** 메가메뉴·browse `region` 탭 id (병합 탭: 유럽+ME·아프, 중국+HK+MO+몽골) */
function continentIdForLegacyCountry(groupKey: string, countryKey: string): string {
  if (groupKey === 'japan') return 'japan'
  if (groupKey === 'china-circle') return 'china-hk-mo'
  if (groupKey === 'sea-taiwan-south-asia') return 'southeast-asia'
  if (groupKey === 'guam-au-nz') return 'oceania'
  if (groupKey === 'americas') return 'americas'
  if (groupKey === 'europe-me-africa') return 'europe-me'
  return 'oceania'
}

function mapMegaGroupInput(g: MegaMenuCountryGroupInput): MegaMenuCountryGroup {
  return {
    countryLabel: g.countryLabel,
    nonLinkHeader: g.nonLinkHeader,
    cities: g.cities.map(
      (c): MegaMenuLeaf => ({
        label: c.label,
        terms: c.terms,
        browseCountryLabel: c.browseCountryLabel,
        sublabel: c.sublabel,
      }),
    ),
  }
}

/**
 * 지리 권역 탭 메가메뉴 — 탭별 전용 빌더로 나라→지역→도시(열) 구조 고정.
 */
export function buildGeographicMegaMenuRegions(): MegaMenuRegion[] {
  const tabToGroups: Record<string, MegaMenuCountryGroupInput[]> = {
    'europe-me': [...buildEuropeMegaMenuGroups(), ...buildMeAfricaMegaMenuGroups()],
    'southeast-asia': buildSeaMegaMenuGroups(),
    japan: buildJapanMegaMenuGroups(),
    'china-hk-mo': buildChinaHkMoMegaMenuGroups(),
    oceania: buildOceaniaMegaMenuGroups(),
    americas: buildAmericasMegaMenuGroups(),
  }

  return CONTINENT_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    countryGroups: (tabToGroups[tab.id] ?? []).map(mapMegaGroupInput).filter((g) => g.cities.length > 0),
  }))
}

/** 테마·크루즈·지방출발 등 — 매칭 트리와 별도 유지 */
export const OVERSEAS_MEGA_MENU_THEME_REGIONS: MegaMenuRegion[] = [
  {
    id: 'cruise',
    label: '크루즈',
    countryGroups: [
      {
        countryLabel: '지중해·북유럽',
        nonLinkHeader: true,
        cities: [
          {
            label: '서부 지중해',
            terms: ['지중해', 'Mediterranean', '크루즈', '바르셀로나', '마르세유', '제노바'],
            sublabel: '바르셀로나 · 몬테카를로 · 로마(치비타베키아)',
          },
          {
            label: '동부 지중해',
            terms: ['지중해', '그리스', '크루즈', '아테네', '산토리니'],
            sublabel: '아테네 · 미코노스 · 산토리니 · 두브로브니크',
          },
          {
            label: '북유럽·발트',
            terms: ['북유럽', '크루즈', '노르웨이', '피오르', '베르겐'],
            sublabel: '베르겐 · 플롬 · 게이랑어르 · 탈린 · 스톡홀름',
          },
          {
            label: '서지중해(서반부)',
            terms: ['지중해', '크루즈', '나폴리', '팔레르모'],
            sublabel: '나폴리 · 팔레르모 · 발레타',
          },
        ],
      },
      {
        countryLabel: '알래스카·캐리비안',
        nonLinkHeader: true,
        cities: [
          {
            label: '알래스카',
            terms: ['알래스카', 'Alaska', '크루즈', '주노', '스카그웨이'],
            sublabel: '주노 · 스카그웨이 · 케치칸 · 빙하만',
          },
          {
            label: '동카리브',
            terms: ['캐리비안', 'Caribbean', '크루즈', '바하마', '푸에르토리코'],
            sublabel: '나소 · 샌후안 · 세인트토마스',
          },
          {
            label: '서카리브·중남미',
            terms: ['캐리비안', 'Caribbean', '크루즈', '쿠바', '멕시코'],
            sublabel: '코즈멜 · 그랜드케이맨 · 로아탄',
          },
        ],
      },
      {
        countryLabel: '동아시아·남태평양',
        nonLinkHeader: true,
        cities: [
          {
            label: '일본',
            terms: ['일본', '크루즈', '후쿠오카', '나가사키', '요코하마'],
            sublabel: '후쿠오카 · 나가사키 · 요코하마 · 오키나와',
          },
          {
            label: '동남아',
            terms: ['동남아', '싱가포르', '크루즈', '방콕', '베트남'],
            sublabel: '싱가포르 · 페낭 · 방콕 · 호치민',
          },
          {
            label: '호주·뉴질랜드',
            terms: ['호주', '뉴질랜드', '크루즈', '시드니', '오클랜드'],
            sublabel: '시드니 · 멜버른 · 오클랜드 · 피오르드랜드',
          },
        ],
      },
    ],
  },
  {
    id: 'local_dep',
    label: '지방출발',
    countryGroups: [
      {
        countryLabel: '부산',
        cities: [
          {
            label: '일본',
            terms: ['부산', '출발', '일본', '후쿠오카', '오사카'],
            sublabel: '후쿠오카 · 오사카 · 나고야',
          },
          {
            label: '동남아',
            terms: ['부산', '출발', '동남아', '방콕', '다낭'],
            sublabel: '방콕 · 다낭 · 세부',
          },
          {
            label: '중국',
            terms: ['부산', '출발', '중국', '상해', '칭다오'],
            sublabel: '상해 · 칭다오 · 연길',
          },
        ],
      },
      {
        countryLabel: '대구',
        cities: [
          {
            label: '일본',
            terms: ['대구', '출발', '일본', '오사카', '후쿠오카'],
            sublabel: '오사카 · 후쿠오카 · 도쿄',
          },
          {
            label: '동남아',
            terms: ['대구', '출발', '동남아', '방콕', '다낭'],
            sublabel: '방콕 · 치앙마이',
          },
          { label: '제주', terms: ['대구', '출발', '제주'], sublabel: '국내 연계' },
        ],
      },
      {
        countryLabel: '광주',
        cities: [
          {
            label: '동남아',
            terms: ['광주', '출발', '동남아', '방콕', '다낭'],
            sublabel: '방콕 · 하노이 · 나트랑',
          },
          {
            label: '일본',
            terms: ['광주', '출발', '일본', '후쿠오카'],
            sublabel: '후쿠오카 · 오사카',
          },
          { label: '중국', terms: ['광주', '출발', '중국', '상해'], sublabel: '상해 · 장가계' },
        ],
      },
      {
        countryLabel: '제주',
        cities: [
          {
            label: '동남아',
            terms: ['제주', '출발', '동남아', '방콕', '다낭'],
            sublabel: '방콕 · 다낭 · 세부',
          },
          { label: '일본', terms: ['제주', '출발', '일본', '오사카'], sublabel: '오사카 · 후쿠오카' },
          { label: '대만', terms: ['제주', '출발', '대만', '타이베이'], sublabel: '타이베이 · 가오슝' },
        ],
      },
      {
        countryLabel: '청주',
        cities: [
          {
            label: '동남아',
            terms: ['청주', '출발', '동남아', '다낭', '세부'],
            sublabel: '다낭 · 세부 · 클락',
          },
          {
            label: '일본',
            terms: ['청주', '출발', '일본', '도쿄', '오사카'],
            sublabel: '도쿄 · 오사카 · 삿포로',
          },
          { label: '괌·사이판', terms: ['청주', '출발', '괌', '사이판'], sublabel: '괌 · 사이판' },
        ],
      },
    ],
  },
  {
    id: 'golf_theme',
    label: '골프',
    countryGroups: [
      {
        countryLabel: '하와이',
        cities: [
          {
            label: '오아후',
            terms: ['하와이', '골프', 'Hawaii', '오아후', '호놀룰루', '와이키키'],
            sublabel: '카폴레이 · 코올리나 · 와이키키',
          },
          {
            label: '마우이',
            terms: ['하와이', '골프', '마우이', 'Maui', '카팔루아'],
            sublabel: '카팔루아 · 와일레아',
          },
          {
            label: '빅아일랜드',
            terms: ['하와이', '골프', '빅아일랜드', 'hilo', 'kona'],
            sublabel: '마우나 케아 권',
          },
        ],
      },
      {
        countryLabel: '괌',
        cities: [
          {
            label: '투몬·탬닝',
            terms: ['괌', '골프', 'Guam', '투몬', '리오'],
            sublabel: '리오 팰리스 · 레오 팰리스',
          },
          {
            label: '정글·남부',
            terms: ['괌', '골프', 'Starts Guam', '남부'],
            sublabel: 'Starts Guam 등',
          },
        ],
      },
      {
        countryLabel: '일본',
        cities: [
          {
            label: '홋카이도',
            terms: ['일본', '골프', '니세코', '삿포로', '홋카이도'],
            sublabel: '니세코 · 루스츠 · 삿포로',
          },
          {
            label: '오키나와',
            terms: ['일본', '골프', '오키나와', '미야코지마'],
            sublabel: '오키나와 · 미야코지마',
          },
          {
            label: '간사이',
            terms: ['일본', '골프', '오사카', '교토', '간사이'],
            sublabel: '오사카 · 교토 · 고베',
          },
          {
            label: '시코쿠',
            terms: ['일본', '골프', '시코쿠', '마쓰야마'],
            sublabel: '마쓰야마 · 가가와',
          },
        ],
      },
      {
        countryLabel: '중국',
        cities: [
          {
            label: '산동',
            terms: ['중국', '골프', '위해', '연태', '청도', '산동'],
            sublabel: '위해 · 연태 · 청도',
          },
          {
            label: '화동',
            terms: ['중국', '골프', '상해', '항주', '소주'],
            sublabel: '상해 · 항주 · 소주',
          },
        ],
      },
      {
        countryLabel: '태국',
        cities: [
          {
            label: '방콕·파타야',
            terms: ['태국', '골프', '방콕', '파타야', 'BKK'],
            sublabel: '시암 컨트리 · 파타야 비치',
          },
          {
            label: '푸켓·끄라비',
            terms: ['태국', '골프', '푸켓', '끄라비', 'Phuket'],
            sublabel: '레이크 · 레드 마운틴',
          },
          {
            label: '치앙마이',
            terms: ['태국', '골프', '치앙마이', 'Chiang Mai'],
            sublabel: '고원 코스 · 알파인',
          },
        ],
      },
      {
        countryLabel: '필리핀',
        cities: [
          {
            label: '세부',
            terms: ['필리핀', '골프', '세부', 'Cebu', '막탄'],
            sublabel: '막탄 · 세부 컨트리',
          },
          {
            label: '클락',
            terms: ['필리핀', '골프', '클락', 'Clark', '앙헬레스'],
            sublabel: '앙헬레스 권',
          },
          {
            label: '마닐라',
            terms: ['필리핀', '골프', '마닐라', 'Manila'],
            sublabel: '안티폴로 · 잭니컬스',
          },
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
 * 지리 권역 탭 + 매칭 그룹을 합친 통합 뷰(플랫하지 않음) — 확장·문서용.
 */
/** `matchProductToOverseasNode` 결과 → browse `continent` 쿼리 슬러그 */
export function continentTabIdForMatch(groupKey: string, countryKey: string | undefined): string {
  return continentIdForLegacyCountry(groupKey, countryKey ?? '')
}

export function buildUnifiedLocationRoot(): UnifiedLocationNode[] {
  const continents: UnifiedLocationNode[] = CONTINENT_TABS.map((c) => ({
    id: c.id,
    label: c.treeLabel ?? c.label,
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
