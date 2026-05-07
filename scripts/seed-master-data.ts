/**
 * I-2: SSOT 마스터(Continent / Country / City / MegaMenuGroupCard) 시드.
 * 원본 트리: lib/overseas-location-tree.data.ts (수정 금지) — 여기서만 분해·매핑.
 *
 *   npx tsx scripts/seed-master-data.ts           # dry-run
 *   npx tsx scripts/seed-master-data.ts --apply   # DB 반영
 */
import './load-env-for-scripts'

import { prisma } from '../lib/prisma'
import { OVERSEAS_LOCATION_TREE_DATA } from '../lib/overseas-location-tree.data'
import type {
  OverseasCountryNode,
  OverseasLeafNode,
  OverseasRegionGroupNode,
} from '../lib/overseas-location-tree.types'

// -----------------------------------------------------------------------------
// A. Continent (한국 여행사 표준 SSOT)
// -----------------------------------------------------------------------------

export const SEED_CONTINENTS: Array<{
  continentKey: string
  koreanLabel: string
  sortOrder: number
}> = [
  { continentKey: 'northeast-asia', koreanLabel: '동북아', sortOrder: 1 },
  { continentKey: 'southeast-asia', koreanLabel: '동남아', sortOrder: 2 },
  { continentKey: 'south-asia', koreanLabel: '서남아', sortOrder: 3 },
  { continentKey: 'europe', koreanLabel: '유럽', sortOrder: 4 },
  { continentKey: 'north-america', koreanLabel: '북미', sortOrder: 5 },
  { continentKey: 'oceania', koreanLabel: '오세아니아', sortOrder: 6 },
  { continentKey: 'middle-east', koreanLabel: '중동', sortOrder: 7 },
  { continentKey: 'africa', koreanLabel: '아프리카', sortOrder: 8 },
  { continentKey: 'south-america', koreanLabel: '중남미', sortOrder: 9 },
]

type SeedCountry = {
  countryKey: string
  continentKey: string
  koreanLabel: string
  sortOrder: number
  isActive: boolean
}

type SeedCity = {
  cityKey: string
  countryKey: string
  koreanLabel: string
  sortOrder: number
  isMajor: boolean
  isActive: boolean
}

type SeedCard = {
  cardKey: string
  koreanLabel: string
  continentKey: string
  displayMode: 'countryGroup' | 'cityGroup' | 'mixed'
  sortOrder: number
  isActive: boolean
}

/** 리프 1개를 여러 도시로 쪼갤 때 (산둥 · 푸켓 묶음 등) */
type CityExpansion = Array<{ cityKey: string; koreanLabel: string; isMajor?: boolean }>

const CLUSTER_EXPANSIONS: Record<string, CityExpansion> = {
  shandong: [
    { cityKey: 'qingdao', koreanLabel: '칭다오', isMajor: true },
    { cityKey: 'yantai', koreanLabel: '연태', isMajor: true },
    { cityKey: 'jinan', koreanLabel: '제남', isMajor: true },
    { cityKey: 'weihai', koreanLabel: '위해', isMajor: true },
  ],
  'phuket-krabi-khaolak': [
    { cityKey: 'phuket', koreanLabel: '푸켓', isMajor: true },
    { cityKey: 'krabi', koreanLabel: '끄라비', isMajor: true },
    { cityKey: 'khaolak', koreanLabel: '카오락', isMajor: false },
  ],
  'chiangmai-chiangrai': [
    { cityKey: 'chiangmai', koreanLabel: '치앙마이', isMajor: true },
    { cityKey: 'chiangrai', koreanLabel: '치앙라이', isMajor: false },
  ],
  'hanoi-halong': [
    { cityKey: 'hanoi', koreanLabel: '하노이', isMajor: true },
    { cityKey: 'halong', koreanLabel: '하롱', isMajor: true },
  ],
  'hue-donghoi': [
    { cityKey: 'hue', koreanLabel: '후에', isMajor: false },
    { cityKey: 'donghoi', koreanLabel: '동허이', isMajor: false },
  ],
  'shizuoka-izu': [
    { cityKey: 'shizuoka', koreanLabel: '시즈오카', isMajor: false },
    { cityKey: 'izu', koreanLabel: '이즈', isMajor: false },
  ],
  'hakone-fuji': [
    { cityKey: 'hakone', koreanLabel: '하코네', isMajor: true },
    { cityKey: 'fuji', koreanLabel: '후지산', isMajor: true },
  ],
  'yokohama-kamakura': [
    { cityKey: 'yokohama', koreanLabel: '요코하마', isMajor: true },
    { cityKey: 'kamakura', koreanLabel: '가마쿠라', isMajor: false },
    { cityKey: 'yamanashi', koreanLabel: '야마나시', isMajor: false },
  ],
  'beppu-yufuin': [
    { cityKey: 'beppu', koreanLabel: '벳부', isMajor: false },
    { cityKey: 'yufuin', koreanLabel: '유후인', isMajor: false },
  ],
  'kumamoto-nagasaki': [
    { cityKey: 'kumamoto', koreanLabel: '구마모토', isMajor: false },
    { cityKey: 'nagasaki', koreanLabel: '나가사키', isMajor: false },
  ],
  'kagoshima-miyazaki': [
    { cityKey: 'kagoshima', koreanLabel: '가고시마', isMajor: false },
    { cityKey: 'miyazaki', koreanLabel: '미야자키', isMajor: false },
  ],
  'kitakyushu-yamaguchi': [
    { cityKey: 'kitakyushu', koreanLabel: '기타큐슈', isMajor: false },
    { cityKey: 'yamaguchi', koreanLabel: '야마구치', isMajor: false },
  ],
  'furano-biei': [
    { cityKey: 'furano', koreanLabel: '후라노', isMajor: true },
    { cityKey: 'biei', koreanLabel: '비에이', isMajor: true },
  ],
  'toya-jozankei': [
    { cityKey: 'toya', koreanLabel: '도야', isMajor: false },
    { cityKey: 'jozankei', koreanLabel: '죠잔케이', isMajor: false },
  ],
  'wakayama-shirahama': [
    { cityKey: 'wakayama', koreanLabel: '와카야마', isMajor: false },
    { cityKey: 'shirahama', koreanLabel: '시라하마', isMajor: false },
  ],
  'takamatsu-naoshima': [
    { cityKey: 'takamatsu', koreanLabel: '다카마츠', isMajor: false },
    { cityKey: 'naoshima', koreanLabel: '나오시마', isMajor: false },
  ],
  'akita-sendai': [
    { cityKey: 'akita', koreanLabel: '아키타', isMajor: false },
    { cityKey: 'sendai', koreanLabel: '센다이', isMajor: true },
  ],
  'beijing-tianjin': [
    { cityKey: 'beijing', koreanLabel: '북경', isMajor: true },
    { cityKey: 'tianjin', koreanLabel: '천진', isMajor: true },
  ],
  sichuan: [
    { cityKey: 'chengdu', koreanLabel: '성도', isMajor: true },
    { cityKey: 'jiuzhaigou', koreanLabel: '구채구', isMajor: true },
    { cityKey: 'chongqing', koreanLabel: '충칭', isMajor: true },
  ],
  yunnan: [
    { cityKey: 'kunming', koreanLabel: '곤명', isMajor: true },
    { cityKey: 'lijiang', koreanLabel: '여강', isMajor: true },
  ],
  'dalian-harbin': [
    { cityKey: 'dalian', koreanLabel: '대련', isMajor: true },
    { cityKey: 'harbin', koreanLabel: '하얼빈', isMajor: true },
  ],
  'xian-urumqi': [
    { cityKey: 'xian', koreanLabel: '서안', isMajor: true },
    { cityKey: 'urumqi', koreanLabel: '우루무치', isMajor: false },
  ],
  'wuhan-yichang': [
    { cityKey: 'wuhan', koreanLabel: '무한', isMajor: true },
    { cityKey: 'yichang', koreanLabel: '은시', isMajor: false },
  ],
  changbai: [
    { cityKey: 'changbai-mountain', koreanLabel: '백두산', isMajor: true },
    { cityKey: 'yanji', koreanLabel: '연길', isMajor: false },
    { cityKey: 'shenyang', koreanLabel: '심양', isMajor: true },
    { cityKey: 'changchun', koreanLabel: '장춘', isMajor: false },
  ],
  'dallas-houston': [
    { cityKey: 'dallas', koreanLabel: '댈러스', isMajor: true },
    { cityKey: 'houston', koreanLabel: '휴스턴', isMajor: true },
    { cityKey: 'new-orleans', koreanLabel: '뉴올리언스', isMajor: false },
  ],
  'orlando-miami': [
    { cityKey: 'orlando', koreanLabel: '올랜도', isMajor: true },
    { cityKey: 'miami', koreanLabel: '마이애미', isMajor: true },
  ],
  'cuba-mexico': [
    { cityKey: 'cancun', koreanLabel: '칸쿤', isMajor: true },
    { cityKey: 'mexico-city', koreanLabel: '멕시코시티', isMajor: true },
  ],
  'quebec': [
    { cityKey: 'quebec-city', koreanLabel: '퀘벡시티', isMajor: false },
    { cityKey: 'montreal', koreanLabel: '몬트리올', isMajor: true },
  ],
  'kanazawa-komatsu': [
    { cityKey: 'kanazawa', koreanLabel: '가나자와', isMajor: true },
    { cityKey: 'komatsu', koreanLabel: '고마츠', isMajor: false },
  ],
  'toyama-alpen': [
    { cityKey: 'toyama', koreanLabel: '도야마', isMajor: false },
    { cityKey: 'alpen-route', koreanLabel: '알펜루트', isMajor: false },
  ],
}

/** 트리 countryKey → SSOT 국가 1개 이상 (권역 노드는 canonical 국가로 접음) */
function continentForGroupCountry(groupKey: string, treeCountryKey: string): string {
  if (groupKey === 'japan') return 'northeast-asia'
  if (groupKey === 'china-circle') return 'northeast-asia'
  if (groupKey === 'sea-taiwan-south-asia') {
    if (treeCountryKey === 'india-nepal-sri-bhutan' || treeCountryKey === 'maldives') return 'south-asia'
    if (treeCountryKey === 'taiwan') return 'southeast-asia'
    return 'southeast-asia'
  }
  if (groupKey === 'guam-au-nz') return 'oceania'
  if (groupKey === 'americas') {
    if (treeCountryKey === 'latin-caribbean') return 'south-america'
    return 'north-america'
  }
  if (groupKey === 'europe-me-africa') {
    if (treeCountryKey === 'middle-east' || treeCountryKey === 'turkey' || treeCountryKey === 'caucasus')
      return 'middle-east'
    if (treeCountryKey === 'africa' || treeCountryKey === 'morocco' || treeCountryKey === 'egypt') return 'africa'
    return 'europe'
  }
  return 'europe'
}

type ResolvedLeaf = { countryKey: string; cities: CityExpansion }

/**
 * 트리 (group, country, leaf) → City가 달릴 SSOT countryKey + 도시 행들
 */
function resolveLeafToCountryAndCities(
  group: OverseasRegionGroupNode,
  country: OverseasCountryNode,
  leaf: OverseasLeafNode,
): ResolvedLeaf {
  const gk = group.groupKey
  const ck = country.countryKey

  if (ck === 'india-nepal-sri-bhutan') {
    const map: Record<string, string> = {
      india: 'india',
      nepal: 'nepal',
      srilanka: 'srilanka',
      bhutan: 'bhutan',
    }
    const canon = map[leaf.nodeKey] ?? 'india'
    const label =
      leaf.nodeLabel.split('·')[0]?.trim() ??
      leaf.nodeLabel.split('·')[0]?.trim() ??
      leaf.nodeLabel
    return {
      countryKey: canon,
      cities: [{ cityKey: leaf.nodeKey, koreanLabel: label, isMajor: true }],
    }
  }

  if (ck === 'malaysia-brunei') {
    if (leaf.nodeKey === 'brunei') return { countryKey: 'brunei', cities: [{ cityKey: 'brunei', koreanLabel: '브루나이', isMajor: true }] }
    if (leaf.nodeKey === 'kotakinabalu') {
      return { countryKey: 'malaysia', cities: [{ cityKey: 'kotakinabalu', koreanLabel: '코타키나발루', isMajor: true }] }
    }
    if (leaf.nodeKey === 'kuala-lumpur') {
      return { countryKey: 'malaysia', cities: [{ cityKey: 'kuala-lumpur', koreanLabel: '쿠알라룸푸르', isMajor: true }] }
    }
    return { countryKey: 'malaysia', cities: [{ cityKey: leaf.nodeKey, koreanLabel: leaf.nodeLabel, isMajor: false }] }
  }

  if (ck === 'hk-mo-sz') {
    if (leaf.nodeKey === 'hongkong') {
      return { countryKey: 'hong-kong', cities: [{ cityKey: 'hongkong', koreanLabel: '홍콩', isMajor: true }] }
    }
    if (leaf.nodeKey === 'macau') {
      return { countryKey: 'macau', cities: [{ cityKey: 'macau', koreanLabel: '마카오', isMajor: true }] }
    }
    return { countryKey: 'china', cities: [{ cityKey: 'shenzhen', koreanLabel: '심천', isMajor: true }] }
  }

  if (ck === 'netherlands') {
    if (leaf.nodeKey === 'be') {
      return { countryKey: 'belgium', cities: [{ cityKey: 'belgium-mix', koreanLabel: '벨기에', isMajor: true }] }
    }
    return { countryKey: 'netherlands', cities: [{ cityKey: 'netherlands-mix', koreanLabel: '네덜란드', isMajor: true }] }
  }

  if (ck === 'uk') {
    if (leaf.nodeKey === 'ie') {
      return { countryKey: 'ireland', cities: [{ cityKey: 'ireland-mix', koreanLabel: '아일랜드', isMajor: true }] }
    }
    return { countryKey: 'united-kingdom', cities: [{ cityKey: 'uk-mix', koreanLabel: '영국', isMajor: true }] }
  }

  if (ck === 'middle-east') {
    const mk: Record<string, string> = {
      dubai: 'united-arab-emirates',
      abudhabi: 'united-arab-emirates',
      jordan: 'jordan',
      saudi: 'saudi-arabia',
      oman: 'oman',
      qatar: 'qatar',
      tunisia: 'tunisia',
    }
    const canon = mk[leaf.nodeKey] ?? 'united-arab-emirates'
    const cityKey =
      leaf.nodeKey === 'dubai'
        ? 'dubai'
        : leaf.nodeKey === 'abudhabi'
          ? 'abudhabi'
          : leaf.nodeKey
    return {
      countryKey: canon,
      cities: [{ cityKey, koreanLabel: leaf.nodeLabel.split('·')[0]?.trim() ?? leaf.nodeLabel, isMajor: true }],
    }
  }

  if (ck === 'nordic-baltic') {
    const nk: Record<string, { c: string; cityKey: string }> = {
      norway: { c: 'norway', cityKey: 'norway-mix' },
      finland: { c: 'finland', cityKey: 'finland-mix' },
      denmark: { c: 'denmark', cityKey: 'denmark-mix' },
      sweden: { c: 'sweden', cityKey: 'sweden-mix' },
      iceland: { c: 'iceland', cityKey: 'iceland-mix' },
    }
    if (leaf.nodeKey === 'baltic3') {
      return {
        countryKey: 'lithuania',
        cities: [
          { cityKey: 'vilnius', koreanLabel: '빌니우스', isMajor: false },
          { cityKey: 'tallinn', koreanLabel: '탈린', isMajor: true },
          { cityKey: 'riga', koreanLabel: '리가', isMajor: false },
        ],
      }
    }
    const hit = nk[leaf.nodeKey]
    if (hit) return { countryKey: hit.c, cities: [{ cityKey: hit.cityKey, koreanLabel: leaf.nodeLabel, isMajor: true }] }
  }

  if (ck === 'caucasus') {
    const ckMap: Record<string, string> = {
      georgia: 'georgia',
      azerbaijan: 'azerbaijan',
      armenia: 'armenia',
    }
    const canon = ckMap[leaf.nodeKey] ?? 'georgia'
    return { countryKey: canon, cities: [{ cityKey: leaf.nodeKey, koreanLabel: leaf.nodeLabel, isMajor: true }] }
  }

  if (ck === 'central-asia') {
    const ckMap: Record<string, string> = {
      kazakhstan: 'kazakhstan',
      kyrgyzstan: 'kyrgyzstan',
      uzbekistan: 'uzbekistan',
    }
    const canon = ckMap[leaf.nodeKey] ?? 'kazakhstan'
    return { countryKey: canon, cities: [{ cityKey: leaf.nodeKey, koreanLabel: leaf.nodeLabel, isMajor: true }] }
  }

  if (ck === 'africa') {
    const ak: Record<string, string> = {
      kenya: 'kenya',
      tanzania: 'tanzania',
      'south-africa': 'south-africa',
      mauritius: 'mauritius',
    }
    const canon = ak[leaf.nodeKey] ?? 'kenya'
    return { countryKey: canon, cities: [{ cityKey: leaf.nodeKey, koreanLabel: leaf.nodeLabel, isMajor: true }] }
  }

  if (ck.startsWith('jp-') || ck === 'jp-ferry') {
    return {
      countryKey: 'japan',
      cities: CLUSTER_EXPANSIONS[leaf.nodeKey] ?? [
        { cityKey: leaf.nodeKey, koreanLabel: leaf.dbCityValue ?? leaf.nodeLabel, isMajor: /도쿄|오사카|후쿠오카|삿포로|나고야|히로시마/.test(leaf.nodeLabel) },
      ],
    }
  }

  if (ck === 'china-major' || ck === 'inner-mongolia') {
    const cities = CLUSTER_EXPANSIONS[leaf.nodeKey] ?? [
      { cityKey: leaf.nodeKey, koreanLabel: leaf.dbCityValue ?? leaf.nodeLabel, isMajor: /상해|북경|홍콩|장가계/.test(leaf.nodeLabel) },
    ]
    return { countryKey: 'china', cities }
  }

  if (ck === 'usa-west' || ck === 'usa-east' || ck === 'usa-south' || ck === 'hawaii' || ck === 'alaska') {
    const cities = CLUSTER_EXPANSIONS[leaf.nodeKey] ?? [
      { cityKey: leaf.nodeKey, koreanLabel: leaf.dbCityValue ?? leaf.nodeLabel, isMajor: true },
    ]
    return { countryKey: 'united-states', cities }
  }

  if (ck === 'latin-caribbean') {
    if (leaf.nodeKey === 'cuba-mexico') {
      throw new Error('cuba-mexico handled in buildMasterSeedFromTree')
    }
    if (leaf.nodeKey === 'south-america') {
      throw new Error('south-america leaf handled in buildMasterSeedFromTree')
    }
    if (leaf.nodeKey === 'caribbean') {
      return { countryKey: 'dominican-republic', cities: [{ cityKey: 'caribbean-mix', koreanLabel: '카리브해', isMajor: false }] }
    }
  }

  if (ck === 'balkans') {
    throw new Error('balkans handled in buildMasterSeedFromTree')
  }

  const canonCountry = TREE_COUNTRY_CANONICAL[ck] ?? ck
  const cities = CLUSTER_EXPANSIONS[leaf.nodeKey] ?? [
    {
      cityKey: leaf.nodeKey,
      koreanLabel: leaf.dbCityValue ?? leaf.nodeLabel.split('·')[0]?.trim() ?? leaf.nodeLabel,
      isMajor: leaf.nodeType === 'city' && leaf.nodeLabel.length < 12,
    },
  ]
  return { countryKey: canonCountry, cities }
}

/** 트리 countryKey → SSOT 단일 국가 키 (일본 권역 등 접기) */
const TREE_COUNTRY_CANONICAL: Record<string, string> = {
  'jp-kanto': 'japan',
  'jp-kansai': 'japan',
  'jp-kyushu': 'japan',
  'jp-hokkaido': 'japan',
  'jp-shikoku-chugoku': 'japan',
  'jp-okinawa': 'japan',
  'jp-chubu-hokuriku': 'japan',
  'jp-tohoku': 'japan',
  'jp-ferry': 'japan',
  'china-major': 'china',
  'inner-mongolia': 'china',
  'hk-mo-sz': 'china',
  'usa-west': 'united-states',
  'usa-east': 'united-states',
  'usa-south': 'united-states',
  hawaii: 'united-states',
  alaska: 'united-states',
}

const COUNTRY_LABELS: Record<string, string> = {
  japan: '일본',
  china: '중국',
  'united-states': '미국',
  canada: '캐나다',
  thailand: '태국',
  vietnam: '베트남',
  philippines: '필리핀',
  malaysia: '말레이시아',
  brunei: '브루나이',
  taiwan: '대만',
  singapore: '싱가포르',
  laos: '라오스',
  cambodia: '캄보디아',
  indonesia: '인도네시아',
  india: '인도',
  nepal: '네팔',
  srilanka: '스리랑카',
  bhutan: '부탄',
  maldives: '몰디브',
  mongolia: '몽골',
  'hong-kong': '홍콩',
  macau: '마카오',
  france: '프랑스',
  switzerland: '스위스',
  italy: '이탈리아',
  'united-kingdom': '영국',
  ireland: '아일랜드',
  netherlands: '네덜란드',
  belgium: '벨기에',
  germany: '독일',
  austria: '오스트리아',
  czech: '체코',
  hungary: '헝가리',
  poland: '폴란드',
  spain: '스페인',
  portugal: '포르투갈',
  morocco: '모로코',
  turkey: '튀르키예',
  greece: '그리스',
  egypt: '이집트',
  croatia: '크로아티아',
  slovenia: '슬로베니아',
  norway: '노르웨이',
  finland: '핀란드',
  denmark: '덴마크',
  sweden: '스웨덴',
  lithuania: '리투아니아',
  estonia: '에스토니아',
  latvia: '라트비아',
  iceland: '아이슬란드',
  georgia: '조지아',
  azerbaijan: '아제르바이잔',
  armenia: '아르메니아',
  jordan: '요르단',
  'saudi-arabia': '사우디아라비아',
  oman: '오만',
  qatar: '카타르',
  tunisia: '튀니지',
  'united-arab-emirates': '아랍에미리트',
  kazakhstan: '카자흐스탄',
  kyrgyzstan: '키르기스스탄',
  uzbekistan: '우즈베키스탄',
  kenya: '케냐',
  tanzania: '탄자니아',
  'south-africa': '남아프리카공화국',
  mauritius: '모리셔스',
  guam: '괌',
  saipan: '사이판',
  australia: '호주',
  newzealand: '뉴질랜드',
  mexico: '멕시코',
  cuba: '쿠바',
  'dominican-republic': '도미니카공화국',
  peru: '페루',
  brazil: '브라질',
  argentina: '아르헨티나',
  chile: '칠레',
  bolivia: '볼리비아',
  korea: '대한민국',
}

function ensureCountry(
  map: Map<string, SeedCountry>,
  countryKey: string,
  continentKey: string,
  sortCounter: { n: number },
): void {
  if (map.has(countryKey)) return
  const label = COUNTRY_LABELS[countryKey] ?? countryKey
  map.set(countryKey, {
    countryKey,
    continentKey,
    koreanLabel: label,
    sortOrder: sortCounter.n++,
    isActive: true,
  })
}

export type MasterSeedBuild = {
  continents: typeof SEED_CONTINENTS
  countries: SeedCountry[]
  cities: SeedCity[]
  cards: SeedCard[]
  cardCountryPairs: Array<{ cardKey: string; countryKey: string; sortOrder: number }>
  cardCityPairs: Array<{ cardKey: string; cityKey: string; sortOrder: number }>
  stats: {
    treeLeaves: number
    singleCountryNodes: number
    multiCountryNodes: number
    regionGroupNodes: number
    singleCityLeaves: number
    multiCityLeaves: number
    themeRouteLeaves: number
    supplementalCountries: string[]
    supplementalCities: string[]
    uncoveredLeaves: string[]
  }
}

export function buildMasterSeedFromTree(tree: OverseasRegionGroupNode[]): MasterSeedBuild {
  const countryMap = new Map<string, SeedCountry>()
  const cityMap = new Map<string, SeedCity>()
  const sortCounter = { n: 0 }
  let treeLeaves = 0
  let singleCountryNodes = 0
  let multiCountryNodes = 0
  let regionGroupNodes = 0
  let singleCityLeaves = 0
  let multiCityLeaves = 0
  let themeRouteLeaves = 0
  const coveredLeaves = new Set<string>()
  const supplementalCountries: string[] = []
  const supplementalCities: string[] = []

  for (const group of tree) {
    for (const country of group.countries) {
      if (country.countryKey === 'india-nepal-sri-bhutan') multiCountryNodes++
      else if (country.countryKey.startsWith('jp-') || ['china-major', 'inner-mongolia'].includes(country.countryKey)) {
        regionGroupNodes++
      } else if (['malaysia-brunei', 'hk-mo-sz', 'netherlands', 'uk', 'middle-east', 'nordic-baltic', 'latin-caribbean'].includes(country.countryKey)) {
        multiCountryNodes++
      } else singleCountryNodes++

      for (const leaf of country.children) {
        treeLeaves++
        const path = `${country.countryKey}|${leaf.nodeKey}`
        if (leaf.nodeType === 'theme' || leaf.nodeType === 'route') {
          themeRouteLeaves++
          coveredLeaves.add(path)
          continue
        }

        if (country.countryKey === 'balkans') {
          if (CLUSTER_EXPANSIONS[leaf.nodeKey] && CLUSTER_EXPANSIONS[leaf.nodeKey]!.length > 1) multiCityLeaves++
          else singleCityLeaves++
          const cont = continentForGroupCountry(group.groupKey, country.countryKey)
          ensureCountry(countryMap, 'croatia', cont, sortCounter)
          ensureCountry(countryMap, 'slovenia', cont, sortCounter)
          if (!cityMap.has('dubrovnik')) {
            cityMap.set('dubrovnik', {
              cityKey: 'dubrovnik',
              countryKey: 'croatia',
              koreanLabel: '두브로브니크',
              sortOrder: 0,
              isMajor: true,
              isActive: true,
            })
          }
          if (!cityMap.has('zagreb')) {
            cityMap.set('zagreb', {
              cityKey: 'zagreb',
              countryKey: 'croatia',
              koreanLabel: '자그레브',
              sortOrder: 1,
              isMajor: false,
              isActive: true,
            })
          }
          if (!cityMap.has('ljubljana')) {
            cityMap.set('ljubljana', {
              cityKey: 'ljubljana',
              countryKey: 'slovenia',
              koreanLabel: '류블랴나',
              sortOrder: 0,
              isMajor: true,
              isActive: true,
            })
          }
          coveredLeaves.add(path)
          continue
        }

        if (country.countryKey === 'latin-caribbean' && leaf.nodeKey === 'cuba-mexico') {
          multiCityLeaves++
          const cont = continentForGroupCountry(group.groupKey, country.countryKey)
          ensureCountry(countryMap, 'mexico', cont, sortCounter)
          ensureCountry(countryMap, 'cuba', cont, sortCounter)
          for (const r of CLUSTER_EXPANSIONS['cuba-mexico']!) {
            if (!cityMap.has(r.cityKey)) {
              cityMap.set(r.cityKey, {
                cityKey: r.cityKey,
                countryKey: 'mexico',
                koreanLabel: r.koreanLabel,
                sortOrder: 0,
                isMajor: r.isMajor ?? false,
                isActive: true,
              })
            }
          }
          if (!cityMap.has('havana')) {
            cityMap.set('havana', {
              cityKey: 'havana',
              countryKey: 'cuba',
              koreanLabel: '아바나',
              sortOrder: 0,
              isMajor: true,
              isActive: true,
            })
          }
          coveredLeaves.add(path)
          continue
        }

        if (country.countryKey === 'latin-caribbean' && leaf.nodeKey === 'south-america') {
          if (CLUSTER_EXPANSIONS[leaf.nodeKey] && CLUSTER_EXPANSIONS[leaf.nodeKey]!.length > 1) multiCityLeaves++
          else multiCityLeaves++
          const cont = 'south-america'
          const rows: Array<{ countryKey: string; cityKey: string; koreanLabel: string; isMajor: boolean }> = [
            { countryKey: 'peru', cityKey: 'lima', koreanLabel: '리마', isMajor: true },
            { countryKey: 'peru', cityKey: 'cusco', koreanLabel: '쿠스코', isMajor: true },
            { countryKey: 'brazil', cityKey: 'rio-de-janeiro', koreanLabel: '리우데자네이루', isMajor: true },
            { countryKey: 'argentina', cityKey: 'buenos-aires', koreanLabel: '부에노스아이레스', isMajor: true },
            { countryKey: 'chile', cityKey: 'santiago', koreanLabel: '산티아고', isMajor: true },
            { countryKey: 'bolivia', cityKey: 'la-paz', koreanLabel: '라파스', isMajor: false },
          ]
          for (const r of rows) {
            ensureCountry(countryMap, r.countryKey, cont, sortCounter)
            if (!cityMap.has(r.cityKey)) {
              cityMap.set(r.cityKey, {
                cityKey: r.cityKey,
                countryKey: r.countryKey,
                koreanLabel: r.koreanLabel,
                sortOrder: 0,
                isMajor: r.isMajor,
                isActive: true,
              })
            }
          }
          coveredLeaves.add(path)
          continue
        }

        if (CLUSTER_EXPANSIONS[leaf.nodeKey] && CLUSTER_EXPANSIONS[leaf.nodeKey]!.length > 1) multiCityLeaves++
        else singleCityLeaves++

        const resolved = resolveLeafToCountryAndCities(group, country, leaf)
        const cont = continentForGroupCountry(group.groupKey, country.countryKey)
        ensureCountry(countryMap, resolved.countryKey, cont, sortCounter)

        let so = 0
        for (const c of resolved.cities) {
          if (cityMap.has(c.cityKey)) continue
          cityMap.set(c.cityKey, {
            cityKey: c.cityKey,
            countryKey: resolved.countryKey,
            koreanLabel: c.koreanLabel,
            sortOrder: so++,
            isMajor: c.isMajor ?? false,
            isActive: true,
          })
        }
        coveredLeaves.add(path)
      }
    }
  }

  /** 트리에 없는 국가 노드: canonical 키로 라벨만 보강 */
  for (const ck of Object.keys(COUNTRY_LABELS)) {
    if (!countryMap.has(ck)) {
      const cont =
        ['korea'].includes(ck)
          ? 'northeast-asia'
          : ['brazil', 'argentina', 'chile', 'bolivia', 'peru'].includes(ck)
            ? 'south-america'
            : 'europe'
      if (ck === 'korea') {
        ensureCountry(countryMap, 'korea', 'northeast-asia', sortCounter)
        supplementalCountries.push('korea')
      }
    }
  }

  /** 한국 주요 도시 보완 (국내 출발·연계 패키지) */
  if (!cityMap.has('seoul')) {
    ensureCountry(countryMap, 'korea', 'northeast-asia', sortCounter)
    cityMap.set('seoul', {
      cityKey: 'seoul',
      countryKey: 'korea',
      koreanLabel: '서울',
      sortOrder: 0,
      isMajor: true,
      isActive: true,
    })
    supplementalCities.push('seoul')
  }
  if (!cityMap.has('busan')) {
    cityMap.set('busan', {
      cityKey: 'busan',
      countryKey: 'korea',
      koreanLabel: '부산',
      sortOrder: 1,
      isMajor: true,
      isActive: true,
    })
    supplementalCities.push('busan')
  }

  /** 니세코(보완) — 홋카이도 스키 */
  if (!cityMap.has('niseko')) {
    ensureCountry(countryMap, 'japan', 'northeast-asia', sortCounter)
    cityMap.set('niseko', {
      cityKey: 'niseko',
      countryKey: 'japan',
      koreanLabel: '니세코',
      sortOrder: 99,
      isMajor: false,
      isActive: true,
    })
    supplementalCities.push('niseko')
  }

  /** 중남미 단일 국가 보완 (남미 leaf가 peru에 몰린 경우 분리용 국가 행) */
  for (const [ck, label] of [
    ['brazil', '브라질'],
    ['argentina', '아르헨티나'],
    ['chile', '칠레'],
    ['bolivia', '볼리비아'],
  ] as const) {
    if (!countryMap.has(ck)) {
      ensureCountry(countryMap, ck, 'south-america', sortCounter)
      countryMap.get(ck)!.koreanLabel = label
      supplementalCountries.push(ck)
    }
  }

  const countries = [...countryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder)
  const cities = [...cityMap.values()].sort((a, b) => `${a.countryKey}:${a.cityKey}`.localeCompare(`${b.countryKey}:${b.cityKey}`))

  const cards: SeedCard[] = []
  const cardCountryPairs: Array<{ cardKey: string; countryKey: string; sortOrder: number }> = []
  const cardCityPairs: Array<{ cardKey: string; cityKey: string; sortOrder: number }> = []
  let cardOrder = 0

  const addCard = (
    card: SeedCard,
    countriesP: string[] = [],
    citiesP: string[] = [],
  ): void => {
    cards.push(card)
    countriesP.forEach((countryKey, i) =>
      cardCountryPairs.push({ cardKey: card.cardKey, countryKey, sortOrder: i }),
    )
    citiesP.forEach((cityKey, i) => cardCityPairs.push({ cardKey: card.cardKey, cityKey, sortOrder: i }))
  }

  addCard(
    {
      cardKey: 'south-asia-india-cluster',
      koreanLabel: '인도 · 네팔 · 스리랑카 · 부탄',
      continentKey: 'south-asia',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['india', 'nepal', 'srilanka', 'bhutan'],
  )

  addCard(
    {
      cardKey: 'china-shandong-cluster',
      koreanLabel: '산둥 · 칭다오 · 연태 · 제남 · 위해',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    ['qingdao', 'yantai', 'jinan', 'weihai'],
  )

  addCard(
    {
      cardKey: 'japan-kansai',
      koreanLabel: '간사이(관서)',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    ['osaka', 'kyoto', 'kobe', 'nara', 'wakayama', 'shirahama'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'japan-hokkaido',
      koreanLabel: '홋카이도',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    ['sapporo', 'hakodate', 'niseko', 'otaru'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'japan-kanto',
      koreanLabel: '간토(관동)',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    ['tokyo', 'yokohama', 'kamakura', 'nikko', 'hakone', 'fuji', 'shizuoka'].filter((k) => cityMap.has(k)),
  )

  const chinaMajorCityKeys = [...cityMap.values()].filter((c) => c.countryKey === 'china').map((c) => c.cityKey)
  addCard(
    {
      cardKey: 'china-major-cities',
      koreanLabel: '중국 주요 도시',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    chinaMajorCityKeys,
  )

  addCard(
    {
      cardKey: 'malaysia-brunei-cluster',
      koreanLabel: '말레이시아 · 브루나이',
      continentKey: 'southeast-asia',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['malaysia', 'brunei'],
    [],
  )

  addCard(
    {
      cardKey: 'hk-mo-sz-cluster',
      koreanLabel: '홍콩 · 마카오 · 심천',
      continentKey: 'northeast-asia',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    [],
    ['hongkong', 'macau', 'shenzhen'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'sea-multi-routes',
      koreanLabel: '동남아 다국가 · 연계',
      continentKey: 'southeast-asia',
      displayMode: 'mixed',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['singapore', 'malaysia', 'indonesia'],
    ['singapore', 'batam'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'nordic-baltic-cluster',
      koreanLabel: '북유럽 · 발트',
      continentKey: 'europe',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['norway', 'finland', 'denmark', 'sweden', 'lithuania', 'estonia', 'latvia', 'iceland'].filter((k) => countryMap.has(k)),
    ['tallinn', 'vilnius', 'riga'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'caucasus-3',
      koreanLabel: '코카서스 3국',
      continentKey: 'middle-east',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['georgia', 'azerbaijan', 'armenia'],
  )

  addCard(
    {
      cardKey: 'europe-benelux-uk',
      koreanLabel: '영국 · 아일랜드 · 네덜란드 · 벨기에',
      continentKey: 'europe',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['united-kingdom', 'ireland', 'netherlands', 'belgium'].filter((k) => countryMap.has(k)),
  )

  addCard(
    {
      cardKey: 'middle-east-gulf',
      koreanLabel: '중동 · 걸프',
      continentKey: 'middle-east',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['united-arab-emirates', 'qatar', 'oman', 'jordan', 'saudi-arabia', 'tunisia'].filter((k) => countryMap.has(k)),
    ['dubai', 'abudhabi', 'doha'].filter((k) => cityMap.has(k)),
  )

  addCard(
    {
      cardKey: 'latin-caribbean-cluster',
      koreanLabel: '중남미 · 카리브',
      continentKey: 'south-america',
      displayMode: 'mixed',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['mexico', 'cuba', 'peru', 'brazil', 'argentina', 'chile', 'bolivia', 'dominican-republic'].filter((k) =>
      countryMap.has(k),
    ),
    ['cancun', 'havana', 'lima', 'rio-de-janeiro', 'buenos-aires', 'santiago', 'caribbean-mix'].filter((k) =>
      cityMap.has(k),
    ),
  )

  addCard(
    {
      cardKey: 'central-asia-stan',
      koreanLabel: '중앙아시아',
      continentKey: 'europe',
      displayMode: 'countryGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['kazakhstan', 'kyrgyzstan', 'uzbekistan'],
  )

  addCard(
    {
      cardKey: 'europe-balkans',
      koreanLabel: '발칸 · 크로아티아 · 슬로베니아',
      continentKey: 'europe',
      displayMode: 'cityGroup',
      sortOrder: cardOrder++,
      isActive: true,
    },
    ['croatia', 'slovenia'].filter((k) => countryMap.has(k)),
    ['dubrovnik', 'ljubljana', 'zagreb'].filter((k) => cityMap.has(k)),
  )

  const allPaths = new Set<string>()
  for (const group of tree) {
    for (const country of group.countries) {
      for (const leaf of country.children) {
        allPaths.add(`${country.countryKey}|${leaf.nodeKey}`)
      }
    }
  }
  const uncoveredLeaves = [...allPaths].filter((p) => !coveredLeaves.has(p))

  return {
    continents: SEED_CONTINENTS,
    countries,
    cities,
    cards,
    cardCountryPairs,
    cardCityPairs,
    stats: {
      treeLeaves,
      singleCountryNodes,
      multiCountryNodes,
      regionGroupNodes,
      singleCityLeaves,
      multiCityLeaves,
      themeRouteLeaves,
      supplementalCountries,
      supplementalCities,
      uncoveredLeaves,
    },
  }
}

// ---------------------------------------------------------------------------
// I-2-PATCH: 트리 권역 1카드(= G 노드) + 리프에서 유도한 Country/City 매핑
// ---------------------------------------------------------------------------

const MEGA_MENU_REGION_CARD_DEF: Array<{
  groupKey: string
  koreanLabel: string
  continentKey: string
  displayMode: SeedCard['displayMode']
}> = [
  {
    groupKey: 'sea-taiwan-south-asia',
    koreanLabel: '동남아 · 대만 · 서남아',
    continentKey: 'southeast-asia',
    displayMode: 'mixed',
  },
  {
    groupKey: 'japan',
    koreanLabel: '일본',
    continentKey: 'northeast-asia',
    displayMode: 'cityGroup',
  },
  {
    groupKey: 'europe-me-africa',
    koreanLabel: '유럽 · 중동 · 아프리카',
    continentKey: 'europe',
    displayMode: 'countryGroup',
  },
  {
    groupKey: 'china-circle',
    koreanLabel: '중국권 · 홍콩 · 마카오 · 몽골 · 중앙아',
    continentKey: 'northeast-asia',
    displayMode: 'mixed',
  },
  {
    groupKey: 'guam-au-nz',
    koreanLabel: '괌/사이판/호주/뉴질랜드',
    continentKey: 'oceania',
    displayMode: 'countryGroup',
  },
  {
    groupKey: 'americas',
    koreanLabel: '미주 · 하와이 · 캐나다 · 중남미',
    continentKey: 'north-america',
    displayMode: 'countryGroup',
  },
]

function collectMegaMenuRegionCoverage(tree: OverseasRegionGroupNode[]): Map<string, { countries: Set<string>; cities: Set<string> }> {
  const byGroup = new Map<string, { countries: Set<string>; cities: Set<string> }>()
  for (const def of MEGA_MENU_REGION_CARD_DEF) {
    byGroup.set(def.groupKey, { countries: new Set(), cities: new Set() })
  }

  const add = (groupKey: string, resolved: ResolvedLeaf): void => {
    const bucket = byGroup.get(groupKey)
    if (!bucket) return
    bucket.countries.add(resolved.countryKey)
    for (const c of resolved.cities) {
      bucket.cities.add(c.cityKey)
    }
  }

  for (const group of tree) {
    const gk = group.groupKey
    if (!byGroup.has(gk)) continue

    for (const country of group.countries) {
      for (const leaf of country.children) {
        if (leaf.nodeType === 'theme' || leaf.nodeType === 'route') continue

        if (country.countryKey === 'balkans') {
          add(gk, {
            countryKey: 'croatia',
            cities: [
              { cityKey: 'dubrovnik', koreanLabel: '두브로브니크', isMajor: true },
              { cityKey: 'zagreb', koreanLabel: '자그레브', isMajor: false },
            ],
          })
          add(gk, {
            countryKey: 'slovenia',
            cities: [{ cityKey: 'ljubljana', koreanLabel: '류블랴나', isMajor: true }],
          })
          continue
        }

        if (country.countryKey === 'latin-caribbean' && leaf.nodeKey === 'cuba-mexico') {
          add(gk, { countryKey: 'mexico', cities: CLUSTER_EXPANSIONS['cuba-mexico']! })
          add(gk, {
            countryKey: 'cuba',
            cities: [{ cityKey: 'havana', koreanLabel: '아바나', isMajor: true }],
          })
          continue
        }

        if (country.countryKey === 'latin-caribbean' && leaf.nodeKey === 'south-america') {
          const rows: ResolvedLeaf[] = [
            { countryKey: 'peru', cities: [{ cityKey: 'lima', koreanLabel: '리마', isMajor: true }] },
            { countryKey: 'peru', cities: [{ cityKey: 'cusco', koreanLabel: '쿠스코', isMajor: true }] },
            { countryKey: 'brazil', cities: [{ cityKey: 'rio-de-janeiro', koreanLabel: '리우데자네이루', isMajor: true }] },
            { countryKey: 'argentina', cities: [{ cityKey: 'buenos-aires', koreanLabel: '부에노스아이레스', isMajor: true }] },
            { countryKey: 'chile', cities: [{ cityKey: 'santiago', koreanLabel: '산티아고', isMajor: true }] },
            { countryKey: 'bolivia', cities: [{ cityKey: 'la-paz', koreanLabel: '라파스', isMajor: false }] },
          ]
          for (const r of rows) add(gk, r)
          continue
        }

        const resolved = resolveLeafToCountryAndCities(group, country, leaf)
        add(gk, resolved)
      }
    }
  }

  const japan = byGroup.get('japan')
  if (japan) {
    japan.countries.add('japan')
    japan.cities.add('niseko')
  }

  return byGroup
}

/**
 * 해외 트리 SSOT의 권역(G) 노드당 메가메뉴 카드 1개 + Country/City 링크 전체.
 * (기존 클러스터 카드 16개와 cardKey가 겹치지 않음)
 */
export function buildMegaMenuRegionCardPayload(tree: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_DATA): {
  cards: SeedCard[]
  cardCountryPairs: Array<{ cardKey: string; countryKey: string; sortOrder: number }>
  cardCityPairs: Array<{ cardKey: string; cityKey: string; sortOrder: number }>
  stats: {
    groupCount: number
    cardCount: number
    countryLinkCount: number
    cityLinkCount: number
    countriesPerCard: Record<string, number>
    citiesPerCard: Record<string, number>
  }
} {
  const coverage = collectMegaMenuRegionCoverage(tree)
  const cards: SeedCard[] = []
  const cardCountryPairs: Array<{ cardKey: string; countryKey: string; sortOrder: number }> = []
  const cardCityPairs: Array<{ cardKey: string; cityKey: string; sortOrder: number }> = []
  const countriesPerCard: Record<string, number> = {}
  const citiesPerCard: Record<string, number> = {}

  for (let i = 0; i < MEGA_MENU_REGION_CARD_DEF.length; i++) {
    const def = MEGA_MENU_REGION_CARD_DEF[i]!
    const bucket = coverage.get(def.groupKey) ?? { countries: new Set<string>(), cities: new Set<string>() }
    const card: SeedCard = {
      cardKey: def.groupKey,
      koreanLabel: def.koreanLabel,
      continentKey: def.continentKey,
      displayMode: def.displayMode,
      sortOrder: i,
      isActive: true,
    }
    cards.push(card)

    const countryList = [...bucket.countries].sort((a, b) => a.localeCompare(b))
    countriesPerCard[def.groupKey] = countryList.length
    countryList.forEach((countryKey, j) => {
      cardCountryPairs.push({ cardKey: def.groupKey, countryKey, sortOrder: j })
    })

    const cityList = [...bucket.cities].sort((a, b) => a.localeCompare(b))
    citiesPerCard[def.groupKey] = cityList.length
    cityList.forEach((cityKey, j) => {
      cardCityPairs.push({ cardKey: def.groupKey, cityKey, sortOrder: j })
    })
  }

  return {
    cards,
    cardCountryPairs,
    cardCityPairs,
    stats: {
      groupCount: MEGA_MENU_REGION_CARD_DEF.length,
      cardCount: cards.length,
      countryLinkCount: cardCountryPairs.length,
      cityLinkCount: cardCityPairs.length,
      countriesPerCard,
      citiesPerCard,
    },
  }
}

/** 패키지에서 re-export 용 */
export let SEED_COUNTRIES: SeedCountry[] = []
export let SEED_CITIES: SeedCity[] = []
export let SEED_CARDS: SeedCard[] = []
export let SEED_CARD_COUNTRY_MAPPING: MasterSeedBuild['cardCountryPairs'] = []
export let SEED_CARD_CITY_MAPPING: MasterSeedBuild['cardCityPairs'] = []

function refreshExports(payload: MasterSeedBuild): void {
  SEED_COUNTRIES = payload.countries
  SEED_CITIES = payload.cities
  SEED_CARDS = payload.cards
  SEED_CARD_COUNTRY_MAPPING = payload.cardCountryPairs
  SEED_CARD_CITY_MAPPING = payload.cardCityPairs
}

function sampleRows<T>(rows: T[], n: number): T[] {
  return rows.slice(0, n)
}

async function runApply(payload: MasterSeedBuild): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      for (const c of payload.continents) {
        await tx.continent.upsert({
          where: { continentKey: c.continentKey },
          create: {
            continentKey: c.continentKey,
            koreanLabel: c.koreanLabel,
            sortOrder: c.sortOrder,
          },
          update: { koreanLabel: c.koreanLabel, sortOrder: c.sortOrder },
        })
      }

      for (const c of payload.countries) {
        await tx.country.upsert({
          where: { countryKey: c.countryKey },
          create: {
            countryKey: c.countryKey,
            continentKey: c.continentKey,
            koreanLabel: c.koreanLabel,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          },
          update: {
            continentKey: c.continentKey,
            koreanLabel: c.koreanLabel,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          },
        })
      }

      for (const c of payload.cities) {
        await tx.city.upsert({
          where: { cityKey: c.cityKey },
          create: {
            cityKey: c.cityKey,
            countryKey: c.countryKey,
            koreanLabel: c.koreanLabel,
            sortOrder: c.sortOrder,
            isMajor: c.isMajor,
            isActive: c.isActive,
          },
          update: {
            countryKey: c.countryKey,
            koreanLabel: c.koreanLabel,
            sortOrder: c.sortOrder,
            isMajor: c.isMajor,
            isActive: c.isActive,
          },
        })
      }

      for (const card of payload.cards) {
        await tx.megaMenuGroupCard.upsert({
          where: { cardKey: card.cardKey },
          create: {
            cardKey: card.cardKey,
            koreanLabel: card.koreanLabel,
            continentKey: card.continentKey,
            displayMode: card.displayMode,
            sortOrder: card.sortOrder,
            isActive: card.isActive,
          },
          update: {
            koreanLabel: card.koreanLabel,
            continentKey: card.continentKey,
            displayMode: card.displayMode,
            sortOrder: card.sortOrder,
            isActive: card.isActive,
          },
        })
      }

      const cardKeys = payload.cards.map((c) => c.cardKey)
      await tx.megaMenuGroupCardCountry.deleteMany({ where: { cardKey: { in: cardKeys } } })
      await tx.megaMenuGroupCardCity.deleteMany({ where: { cardKey: { in: cardKeys } } })

      if (payload.cardCountryPairs.length) {
        await tx.megaMenuGroupCardCountry.createMany({
          data: payload.cardCountryPairs.map((p) => ({
            cardKey: p.cardKey,
            countryKey: p.countryKey,
            sortOrder: p.sortOrder,
          })),
        })
      }
      if (payload.cardCityPairs.length) {
        await tx.megaMenuGroupCardCity.createMany({
          data: payload.cardCityPairs.map((p) => ({
            cardKey: p.cardKey,
            cityKey: p.cityKey,
            sortOrder: p.sortOrder,
          })),
        })
      }
    },
    { timeout: 120_000 },
  )
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const payload = buildMasterSeedFromTree(OVERSEAS_LOCATION_TREE_DATA)
  refreshExports(payload)

  console.log('[seed-master-data] mode:', apply ? 'APPLY' : 'dry-run')
  console.log('[seed-master-data] tree decomposition stats:', JSON.stringify(payload.stats, null, 2))
  console.log(
    '[seed-master-data] row counts:',
    JSON.stringify(
      {
        continents: payload.continents.length,
        countries: payload.countries.length,
        cities: payload.cities.length,
        cards: payload.cards.length,
        cardCountryLinks: payload.cardCountryPairs.length,
        cardCityLinks: payload.cardCityPairs.length,
      },
      null,
      2,
    ),
  )

  console.log('[seed-master-data] supplemental countries:', payload.stats.supplementalCountries)
  console.log('[seed-master-data] supplemental cities:', payload.stats.supplementalCities)

  if (payload.stats.uncoveredLeaves.length) {
    console.warn('[seed-master-data] uncovered leaves:', payload.stats.uncoveredLeaves)
  }

  console.log('[seed-master-data] sample continents:', sampleRows(payload.continents, 10))
  console.log('[seed-master-data] sample countries:', sampleRows(payload.countries, 10))
  console.log('[seed-master-data] sample cities:', sampleRows(payload.cities, 10))
  console.log('[seed-master-data] sample cards:', sampleRows(payload.cards, 10))
  console.log('[seed-master-data] sample card↔country:', sampleRows(payload.cardCountryPairs, 10))
  console.log('[seed-master-data] sample card↔city:', sampleRows(payload.cardCityPairs, 10))

  /** 트리의 집계 노드(단일 Country 행이 아님) — 리프 처리 시 이미 하위 국가가 시드됨 */
  const AGGREGATE_TREE_COUNTRY_KEYS = new Set([
    'sea-multi',
    'buddhist-pilgrimage',
    'europe-pilgrimage',
    'china-trekking',
    'sports-tours',
    'caucasus',
    'middle-east',
    'nordic-baltic',
    'africa',
    'central-asia',
  ])

  const treeCountryKeys = new Set<string>()
  for (const g of OVERSEAS_LOCATION_TREE_DATA) {
    for (const c of g.countries) {
      if (AGGREGATE_TREE_COUNTRY_KEYS.has(c.countryKey)) continue
      if (c.countryKey === 'india-nepal-sri-bhutan') {
        for (const lf of c.children) treeCountryKeys.add(lf.nodeKey)
      } else if (c.countryKey === 'malaysia-brunei') {
        treeCountryKeys.add('malaysia')
        treeCountryKeys.add('brunei')
      } else if (c.countryKey === 'hk-mo-sz') {
        treeCountryKeys.add('hong-kong')
        treeCountryKeys.add('macau')
        treeCountryKeys.add('china')
      } else if (c.countryKey === 'uk') {
        treeCountryKeys.add('united-kingdom')
        treeCountryKeys.add('ireland')
      } else if (c.countryKey === 'netherlands') {
        treeCountryKeys.add('netherlands')
        treeCountryKeys.add('belgium')
      } else if (c.countryKey === 'balkans') {
        treeCountryKeys.add('croatia')
        treeCountryKeys.add('slovenia')
      } else if (c.countryKey === 'latin-caribbean') {
        treeCountryKeys.add('mexico')
        treeCountryKeys.add('cuba')
        treeCountryKeys.add('peru')
        treeCountryKeys.add('brazil')
        treeCountryKeys.add('argentina')
        treeCountryKeys.add('chile')
        treeCountryKeys.add('bolivia')
        treeCountryKeys.add('dominican-republic')
      } else {
        const canon = TREE_COUNTRY_CANONICAL[c.countryKey] ?? c.countryKey
        treeCountryKeys.add(canon)
      }
    }
  }
  for (const k of ['india', 'nepal', 'srilanka', 'bhutan']) treeCountryKeys.add(k)

  const missingCountryForTags = [...treeCountryKeys].filter((k) => !payload.countries.some((c) => c.countryKey === k))
  if (missingCountryForTags.length) {
    console.warn('[seed-master-data] ProductCountryTag FK risk — countries missing from seed:', missingCountryForTags)
  } else {
    console.log('[seed-master-data] all inferred tree canonical country keys present in Country seed.')
  }
  console.log(
    '[seed-master-data] 참고: Product.countryKey·countryTags에 트리 권역(jp-kansai 등)이 남아 있으면 I-3에서 japan 등 SSOT 키로 맞춘 뒤 FK가 완전히 정합됩니다.',
  )

  if (!apply) {
    console.log('[seed-master-data] dry-run only. Pass --apply to write DB.')
    return
  }

  await runApply(payload)
  console.log('[seed-master-data] APPLY completed.')
}

const isSeedMasterEntry =
  /[\\/]seed-master-data\.(ts|js)$/.test((process.argv[1] ?? '').replace(/\\/g, '/'))

if (isSeedMasterEntry) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
