/**
 * 해외 메가메뉴 지리 탭 — 유럽·중동/아프리카·중국 등 권역별 그룹 헤더 + 하위 행.
 * 매칭용 트리 키(groupKey/countryKey/leaf)는 `overseas-location-tree.data` SSOT 유지.
 */
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import type { OverseasCountryNode, OverseasLeafNode } from '@/lib/overseas-location-tree.types'

export type MegaMenuLeafInput = {
  label: string
  terms: string[]
  /** browse URL `country` 슬러그 — 트리 `country.countryLabel` 과 동일해야 destination 매칭이 된다 */
  browseCountryLabel: string
}

export type MegaMenuCountryGroupInput = {
  countryLabel: string
  cities: MegaMenuLeafInput[]
  /** 권역만 표기할 때 헤더는 링크 없이 텍스트 */
  nonLinkHeader?: boolean
}

function findCountry(groupKey: string, countryKey: string): OverseasCountryNode | undefined {
  const g = OVERSEAS_LOCATION_TREE_DATA.find((x) => x.groupKey === groupKey)
  return g?.countries.find((c) => c.countryKey === countryKey)
}

function collectLeafTerms(country: OverseasCountryNode, leaf: OverseasLeafNode): string[] {
  const set = new Set<string>()
  const add = (s?: string | null) => {
    if (s?.trim()) set.add(s.trim())
  }
  add(leaf.nodeLabel)
  leaf.aliases?.forEach((x) => add(x))
  leaf.supplierKeywords?.forEach((x) => add(x))
  leaf.supplierOnlyLabels?.forEach((x) => add(x))
  add(country.countryLabel)
  country.aliases?.forEach((x) => add(x))
  country.supplierKeywords?.forEach((x) => add(x))
  return [...set]
}

function leafFromCountry(config: {
  groupKey: string
  countryKey: string
  displayLabel: string
  leafKeys?: readonly string[]
  termsOverride?: string[]
}): MegaMenuLeafInput | null {
  const country = findCountry(config.groupKey, config.countryKey)
  if (!country) return null
  if (config.termsOverride?.length) {
    return {
      label: config.displayLabel,
      terms: [...new Set(config.termsOverride)],
      browseCountryLabel: country.countryLabel,
    }
  }
  const leaves =
    config.leafKeys && config.leafKeys.length > 0
      ? country.children.filter((l) => config.leafKeys!.includes(l.nodeKey))
      : country.children
  if (leaves.length === 0) return null
  const termSet = new Set<string>()
  for (const leaf of leaves) {
    collectLeafTerms(country, leaf).forEach((t) => termSet.add(t))
  }
  return {
    label: config.displayLabel,
    terms: [...termSet],
    browseCountryLabel: country.countryLabel,
  }
}

const GK_EU = 'europe-me-africa' as const
const GK_CN = 'china-circle' as const

/** 유럽 탭 — 지역 헤더 + 나라(또는 권역) 행 */
export function buildEuropeMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  const g = (
    header: string,
    items: {
      label: string
      ck: string
      leafKeys?: readonly string[]
      termsOverride?: string[]
    }[],
    nonLinkHeader = false,
  ): MegaMenuCountryGroupInput => ({
    countryLabel: header,
    nonLinkHeader,
    cities: items
      .map((it) =>
        leafFromCountry({
          groupKey: GK_EU,
          countryKey: it.ck,
          displayLabel: it.label,
          leafKeys: it.leafKeys,
          termsOverride: it.termsOverride,
        }),
      )
      .filter((x): x is MegaMenuLeafInput => x != null),
  })

  return [
    g('서유럽', [
      { label: '프랑스', ck: 'france' },
      { label: '스위스', ck: 'switzerland' },
      { label: '이탈리아', ck: 'italy' },
      { label: '영국', ck: 'uk' },
      { label: '네덜란드', ck: 'netherlands' },
    ]),
    g('동유럽', [
      { label: '체코', ck: 'czech' },
      { label: '오스트리아', ck: 'austria' },
      { label: '헝가리', ck: 'hungary' },
      { label: '독일', ck: 'germany' },
    ]),
    g('발칸', [
      {
        label: '크로아티아',
        ck: 'balkans',
        termsOverride: ['크로아티아', 'croatia', '발칸', 'balkan'],
      },
      {
        label: '슬로베니아',
        ck: 'balkans',
        termsOverride: ['슬로베니아', 'slovenia', '발칸', 'balkan'],
      },
    ]),
    g('스페인/포르투갈', [
      { label: '스페인', ck: 'spain' },
      { label: '포르투갈', ck: 'portugal' },
      { label: '모로코', ck: 'morocco' },
    ]),
    g('튀르키예', [{ label: '튀르키예', ck: 'turkey' }]),
    g('이집트', [{ label: '이집트', ck: 'egypt' }]),
    g('그리스', [{ label: '그리스', ck: 'greece' }]),
    g('북유럽', [
      { label: '노르웨이', ck: 'nordic-baltic', leafKeys: ['norway'] },
      { label: '핀란드', ck: 'nordic-baltic', leafKeys: ['finland'] },
      { label: '덴마크', ck: 'nordic-baltic', leafKeys: ['denmark'] },
      { label: '스웨덴', ck: 'nordic-baltic', leafKeys: ['sweden'] },
      { label: '아이슬란드', ck: 'nordic-baltic', leafKeys: ['iceland'] },
      { label: '발트 3국', ck: 'nordic-baltic', leafKeys: ['baltic3'] },
    ]),
  ]
}

/** 중동/아프리카 탭 */
export function buildMeAfricaMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  const g = (
    header: string,
    items: { label: string; ck: string; leafKeys?: readonly string[] }[],
    nonLinkHeader = false,
  ): MegaMenuCountryGroupInput => ({
    countryLabel: header,
    nonLinkHeader,
    cities: items
      .map((it) =>
        leafFromCountry({
          groupKey: GK_EU,
          countryKey: it.ck,
          displayLabel: it.label,
          leafKeys: it.leafKeys,
        }),
      )
      .filter((x): x is MegaMenuLeafInput => x != null),
  })

  return [
    g('중동', [
      { label: '두바이', ck: 'middle-east', leafKeys: ['dubai'] },
      { label: '아부다비', ck: 'middle-east', leafKeys: ['abudhabi'] },
      { label: '사우디아라비아', ck: 'middle-east', leafKeys: ['saudi'] },
      { label: '요르단', ck: 'middle-east', leafKeys: ['jordan'] },
      { label: '카타르', ck: 'middle-east', leafKeys: ['qatar'] },
      { label: '오만', ck: 'middle-east', leafKeys: ['oman'] },
      { label: '튀니지', ck: 'middle-east', leafKeys: ['tunisia'] },
    ]),
    g('아프리카', [
      { label: '모리셔스', ck: 'africa', leafKeys: ['mauritius'] },
      { label: '케냐', ck: 'africa', leafKeys: ['kenya'] },
      { label: '탄자니아', ck: 'africa', leafKeys: ['tanzania'] },
      { label: '남아공', ck: 'africa', leafKeys: ['south-africa'] },
    ]),
    g('코카서스 3국', [
      { label: '조지아', ck: 'caucasus', leafKeys: ['georgia'] },
      { label: '아제르바이잔', ck: 'caucasus', leafKeys: ['azerbaijan'] },
      { label: '아르메니아', ck: 'caucasus', leafKeys: ['armenia'] },
    ]),
    g('유럽 성지순례', [{ label: '유럽 성지순례', ck: 'europe-pilgrimage', leafKeys: ['eu-pilgrimage'] }]),
  ]
}

/** 중국 탭 (홍콩/마카오 제외) */
export function buildChinaMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  const g = (
    header: string,
    items: { label: string; ck: string; leafKeys?: readonly string[]; termsOverride?: string[] }[],
    nonLinkHeader = false,
  ): MegaMenuCountryGroupInput => ({
    countryLabel: header,
    nonLinkHeader,
    cities: items
      .map((it) =>
        leafFromCountry({
          groupKey: GK_CN,
          countryKey: it.ck,
          displayLabel: it.label,
          leafKeys: it.leafKeys,
          termsOverride: it.termsOverride,
        }),
      )
      .filter((x): x is MegaMenuLeafInput => x != null),
  })

  return [
    g('중국 주요도시', [
      { label: '상해', ck: 'china-major', leafKeys: ['shanghai'] },
      { label: '북경', ck: 'china-major', leafKeys: ['beijing-tianjin'] },
      { label: '청도 · 위해 · 연태', ck: 'china-major', leafKeys: ['shandong'] },
      { label: '대련', ck: 'china-major', leafKeys: ['dalian-harbin'] },
    ]),
    g('장가계/화남', [
      { label: '장가계', ck: 'china-major', leafKeys: ['zhangjiajie'] },
      {
        label: '장사',
        ck: 'china-major',
        termsOverride: ['장사', 'changsha', '长沙', '장가계', 'zhangjiajie'],
      },
      { label: '무한', ck: 'china-major', leafKeys: ['wuhan-yichang'] },
      { label: '계림', ck: 'china-major', leafKeys: ['guilin'] },
      {
        label: '광저우',
        ck: 'china-major',
        termsOverride: ['광저우', '광주', 'guangzhou', '广州', '중국'],
      },
    ]),
    g('백두산/동북', [
      { label: '연길 · 심양 · 장춘 · 백두산', ck: 'china-major', leafKeys: ['changbai'] },
      { label: '하얼빈', ck: 'china-major', leafKeys: ['dalian-harbin'] },
    ]),
    g('서부/내륙', [
      { label: '성도 · 구채구', ck: 'china-major', leafKeys: ['sichuan'] },
      { label: '서안 · 우루무치', ck: 'china-major', leafKeys: ['xian-urumqi'] },
      { label: '곤명 · 여강', ck: 'china-major', leafKeys: ['yunnan'] },
      { label: '귀주 · 안순', ck: 'china-major', leafKeys: ['guizhou'] },
      { label: '하이난', ck: 'china-major', leafKeys: ['hainan'] },
      { label: '항주', ck: 'china-major', leafKeys: ['hangzhou'] },
    ]),
    g('몽골/중앙아시아', [
      { label: '몽골', ck: 'mongolia' },
      { label: '내몽골', ck: 'inner-mongolia' },
      { label: '카자흐스탄', ck: 'central-asia', leafKeys: ['kazakhstan'] },
      { label: '우즈베키스탄', ck: 'central-asia', leafKeys: ['uzbekistan'] },
      { label: '키르기스스탄', ck: 'central-asia', leafKeys: ['kyrgyzstan'] },
      { label: '중국 트레킹', ck: 'china-trekking', leafKeys: ['cn-trek'] },
    ]),
  ]
}
