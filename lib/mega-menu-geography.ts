/**
 * 해외 메가메뉴 지리 탭 — 유럽·중동/아프리카·중국 등 권역별 그룹 헤더 + 하위 행.
 * 매칭용 트리 키(groupKey/countryKey/leaf)는 `overseas-location-tree.data` SSOT 유지.
 *
 * 동일 트리 국가 노드(예: `china-major`, 유럽 `nordic-baltic`·`middle-east`)를 여러 메가메뉴 행으로 쪼갤 때는
 * `browseCountryLabelForUrl`으로 행마다 browse `country` 슬러그를 다르게 두고, `browse-country-url-resolve`의
 * 권역별 서브필터(일본·중국 등)와 맞춘다.
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
  /** 메가메뉴 행마다 browse `country` 슬러그를 다르게 할 때(중국 주요도시 등 동일 트리 노드 복수 행) */
  browseCountryLabelForUrl?: string
}): MegaMenuLeafInput | null {
  const country = findCountry(config.groupKey, config.countryKey)
  if (!country) return null
  const browseCountryLabel = config.browseCountryLabelForUrl ?? country.countryLabel
  if (config.termsOverride?.length) {
    return {
      label: config.displayLabel,
      terms: [...new Set(config.termsOverride)],
      browseCountryLabel,
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
    browseCountryLabel,
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
      { label: '이탈리아', ck: 'italy' },
      { label: '프랑스', ck: 'france' },
      { label: '스위스', ck: 'switzerland' },
      { label: '영국', ck: 'uk' },
      { label: '독일', ck: 'germany' },
    ]),
    g('동유럽', [
      { label: '체코', ck: 'czech' },
      { label: '오스트리아', ck: 'austria' },
      { label: '헝가리', ck: 'hungary' },
      { label: '폴란드', ck: 'poland' },
    ]),
    g('북유럽', [
      { label: '덴마크', ck: 'nordic-baltic', leafKeys: ['denmark'] },
      { label: '노르웨이', ck: 'nordic-baltic', leafKeys: ['norway'] },
      { label: '스웨덴', ck: 'nordic-baltic', leafKeys: ['sweden'] },
      { label: '핀란드', ck: 'nordic-baltic', leafKeys: ['finland'] },
    ]),
    g('스페인/포르투갈', [
      { label: '스페인', ck: 'spain' },
      { label: '포르투갈', ck: 'portugal' },
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
    g('그리스', [
      { label: '아테네', ck: 'greece', leafKeys: ['athens'] },
      { label: '산토리니', ck: 'greece', leafKeys: ['santorini'] },
    ]),
    g('튀르키예', [
      { label: '이스탄불', ck: 'turkey', leafKeys: ['istanbul'] },
      { label: '카파도키아', ck: 'turkey', leafKeys: ['cappadocia'] },
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
    g('북아프·지중해', [{ label: '이집트', ck: 'egypt' }]),
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
          browseCountryLabelForUrl:
            it.ck === 'china-major' || it.ck === 'inner-mongolia' || it.ck === 'china-trekking'
              ? it.label
              : undefined,
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

const GK_JP = 'japan' as const
const GK_SEA = 'sea-taiwan-south-asia' as const
const GK_GUAM = 'guam-au-nz' as const
const GK_AM = 'americas' as const

type MegaRow = {
  label: string
  ck: string
  leafKeys?: readonly string[]
  termsOverride?: string[]
  browseCountryLabelForUrl?: string
}

function megaGroup(header: string, groupKey: string, items: MegaRow[], nonLinkHeader = false): MegaMenuCountryGroupInput {
  return {
    countryLabel: header,
    nonLinkHeader,
    cities: items
      .map((it) =>
        leafFromCountry({
          groupKey,
          countryKey: it.ck,
          displayLabel: it.label,
          leafKeys: it.leafKeys,
          termsOverride: it.termsOverride,
          browseCountryLabelForUrl: it.browseCountryLabelForUrl,
        }),
      )
      .filter((x): x is MegaMenuLeafInput => x != null),
  }
}

/** 일본 탭 — 지역(행) + 도시 */
export function buildJapanMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  return [
    megaGroup('홋카이도', GK_JP, [
      { label: '삿포로', ck: 'jp-hokkaido', leafKeys: ['sapporo'], browseCountryLabelForUrl: '삿포로' },
      {
        label: '니세코',
        ck: 'jp-hokkaido',
        termsOverride: ['니세코', 'Niseko', 'niseko'],
        browseCountryLabelForUrl: '니세코',
      },
      { label: '오타루', ck: 'jp-hokkaido', leafKeys: ['otaru'], browseCountryLabelForUrl: '오타루' },
      {
        label: '후라노',
        ck: 'jp-hokkaido',
        leafKeys: ['furano-biei'],
        browseCountryLabelForUrl: '후라노',
      },
      { label: '하코다테', ck: 'jp-hokkaido', leafKeys: ['hakodate'], browseCountryLabelForUrl: '하코다테' },
    ]),
    megaGroup('도호쿠', GK_JP, [
      {
        label: '센다이',
        ck: 'jp-tohoku',
        termsOverride: ['센다이', 'sendai', '도호쿠'],
        browseCountryLabelForUrl: '센다이',
      },
      { label: '아오모리', ck: 'jp-tohoku', leafKeys: ['aomori'], browseCountryLabelForUrl: '아오모리' },
    ]),
    megaGroup('간토', GK_JP, [
      { label: '도쿄', ck: 'jp-kanto', leafKeys: ['tokyo'], browseCountryLabelForUrl: '도쿄' },
      {
        label: '요코하마',
        ck: 'jp-kanto',
        leafKeys: ['yokohama-kamakura'],
        browseCountryLabelForUrl: '요코하마',
      },
    ]),
    megaGroup('추부', GK_JP, [
      { label: '나고야', ck: 'jp-chubu-hokuriku', leafKeys: ['nagoya'], browseCountryLabelForUrl: '나고야' },
      {
        label: '가나자와',
        ck: 'jp-chubu-hokuriku',
        leafKeys: ['kanazawa-komatsu'],
        browseCountryLabelForUrl: '가나자와',
      },
      { label: '다카야마', ck: 'jp-chubu-hokuriku', leafKeys: ['takayama'], browseCountryLabelForUrl: '다카야마' },
    ]),
    megaGroup('간사이', GK_JP, [
      { label: '오사카', ck: 'jp-kansai', leafKeys: ['osaka'], browseCountryLabelForUrl: '오사카' },
      { label: '교토', ck: 'jp-kansai', leafKeys: ['kyoto'], browseCountryLabelForUrl: '교토' },
      { label: '고베', ck: 'jp-kansai', leafKeys: ['kobe'], browseCountryLabelForUrl: '고베' },
      { label: '나라', ck: 'jp-kansai', leafKeys: ['nara'], browseCountryLabelForUrl: '나라' },
    ]),
    megaGroup('주고쿠-시코쿠', GK_JP, [
      { label: '히로시마', ck: 'jp-shikoku-chugoku', leafKeys: ['hiroshima'], browseCountryLabelForUrl: '히로시마' },
      { label: '요나고', ck: 'jp-shikoku-chugoku', leafKeys: ['yonago'], browseCountryLabelForUrl: '요나고' },
      { label: '돗토리', ck: 'jp-shikoku-chugoku', leafKeys: ['tottori'], browseCountryLabelForUrl: '돗토리' },
      {
        label: '마츠야마',
        ck: 'jp-shikoku-chugoku',
        leafKeys: ['matsuyama'],
        browseCountryLabelForUrl: '마츠야마',
      },
    ]),
    megaGroup('규슈', GK_JP, [
      { label: '후쿠오카', ck: 'jp-kyushu', leafKeys: ['fukuoka'], browseCountryLabelForUrl: '후쿠오카' },
      {
        label: '나가사키',
        ck: 'jp-kyushu',
        termsOverride: ['나가사키', 'nagasaki', '규슈'],
        browseCountryLabelForUrl: '나가사키',
      },
      {
        label: '벳부',
        ck: 'jp-kyushu',
        termsOverride: ['벳부', 'beppu'],
        browseCountryLabelForUrl: '벳부',
      },
      {
        label: '유후인',
        ck: 'jp-kyushu',
        termsOverride: ['유후인', 'yufuin'],
        browseCountryLabelForUrl: '유후인',
      },
      {
        label: '가고시마',
        ck: 'jp-kyushu',
        termsOverride: ['가고시마', 'kagoshima', '규슈'],
        browseCountryLabelForUrl: '가고시마',
      },
    ]),
    megaGroup('오키나와', GK_JP, [
      { label: '오키나와', ck: 'jp-okinawa', leafKeys: ['okinawa-main'], browseCountryLabelForUrl: '오키나와' },
      {
        label: '나하',
        ck: 'jp-okinawa',
        termsOverride: ['나하', 'naha', '오키나와'],
        browseCountryLabelForUrl: '나하',
      },
    ]),
  ]
}

/** 동남아/대만/서남아 탭 — 나라(열) + 도시 */
export function buildSeaMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  return [
    megaGroup('베트남', GK_SEA, [
      { label: '다낭', ck: 'vietnam', leafKeys: ['danang'], browseCountryLabelForUrl: '다낭' },
      { label: '나트랑', ck: 'vietnam', leafKeys: ['nhatrang'], browseCountryLabelForUrl: '나트랑' },
      { label: '푸꾸옥', ck: 'vietnam', leafKeys: ['phuquoc'], browseCountryLabelForUrl: '푸꾸옥' },
      {
        label: '하노이',
        ck: 'vietnam',
        leafKeys: ['hanoi-halong'],
        browseCountryLabelForUrl: '하노이',
      },
      { label: '호치민', ck: 'vietnam', leafKeys: ['hochiminh'], browseCountryLabelForUrl: '호치민' },
    ]),
    megaGroup('태국', GK_SEA, [
      { label: '방콕', ck: 'thailand', leafKeys: ['bangkok'], browseCountryLabelForUrl: '방콕' },
      {
        label: '푸켓',
        ck: 'thailand',
        termsOverride: ['푸켓', 'phuket', '끄라비', 'krabi'],
        browseCountryLabelForUrl: '푸켓',
      },
      {
        label: '치앙마이',
        ck: 'thailand',
        leafKeys: ['chiangmai-chiangrai'],
        browseCountryLabelForUrl: '치앙마이',
      },
      { label: '파타야', ck: 'thailand', leafKeys: ['pattaya'], browseCountryLabelForUrl: '파타야' },
    ]),
    megaGroup('싱가포르', GK_SEA, [
      { label: '싱가포르', ck: 'singapore', leafKeys: ['singapore'], browseCountryLabelForUrl: '싱가포르' },
    ]),
    megaGroup('인도네시아', GK_SEA, [
      { label: '발리', ck: 'indonesia', leafKeys: ['bali'], browseCountryLabelForUrl: '발리' },
      { label: '마나도', ck: 'indonesia', leafKeys: ['manado'], browseCountryLabelForUrl: '마나도' },
    ]),
    megaGroup('필리핀', GK_SEA, [
      { label: '보홀', ck: 'philippines', leafKeys: ['bohol'], browseCountryLabelForUrl: '보홀' },
      { label: '세부', ck: 'philippines', leafKeys: ['cebu'], browseCountryLabelForUrl: '세부' },
      { label: '클락', ck: 'philippines', leafKeys: ['clark'], browseCountryLabelForUrl: '클락' },
    ]),
    megaGroup('대만', GK_SEA, [
      { label: '타이베이', ck: 'taiwan', leafKeys: ['taipei'], browseCountryLabelForUrl: '타이베이' },
      { label: '가오슝', ck: 'taiwan', leafKeys: ['kaohsiung'], browseCountryLabelForUrl: '가오슝' },
    ]),
    megaGroup('말레이시아', GK_SEA, [
      {
        label: '코타키나발루',
        ck: 'malaysia-brunei',
        leafKeys: ['kotakinabalu'],
        browseCountryLabelForUrl: '코타키나발루',
      },
      {
        label: '쿠알라룸푸르',
        ck: 'malaysia-brunei',
        leafKeys: ['kuala-lumpur'],
        browseCountryLabelForUrl: '쿠알라룸푸르',
      },
    ]),
    megaGroup('라오스', GK_SEA, [
      { label: '비엔티안', ck: 'laos', leafKeys: ['vientiane'], browseCountryLabelForUrl: '비엔티안' },
    ]),
    megaGroup('인도', GK_SEA, [
      {
        label: '델리',
        ck: 'india-nepal-sri-bhutan',
        leafKeys: ['india'],
        browseCountryLabelForUrl: '델리',
      },
    ]),
    megaGroup('스리랑카', GK_SEA, [
      {
        label: '콜롬보',
        ck: 'india-nepal-sri-bhutan',
        leafKeys: ['srilanka'],
        browseCountryLabelForUrl: '콜롬보',
      },
    ]),
  ]
}

/** 중국/홍콩/마카오/몽골 탭 */
export function buildChinaHkMoMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  const cn = (header: string, items: MegaRow[]) => megaGroup(header, GK_CN, items)
  return [
    cn('산동', [
      {
        label: '청도',
        ck: 'china-major',
        termsOverride: ['청도', '칭다오', 'qingdao', '산동'],
        browseCountryLabelForUrl: '청도',
      },
      {
        label: '위해',
        ck: 'china-major',
        termsOverride: ['위해', 'weihai', '웨이하이', '산동'],
        browseCountryLabelForUrl: '위해',
      },
      {
        label: '연태',
        ck: 'china-major',
        termsOverride: ['연태', 'yantai', '옌타이', '산동'],
        browseCountryLabelForUrl: '연태',
      },
    ]),
    cn('화동', [
      { label: '상해', ck: 'china-major', leafKeys: ['shanghai'], browseCountryLabelForUrl: '상해' },
      {
        label: '소주',
        ck: 'china-major',
        browseCountryLabelForUrl: '소주',
        termsOverride: ['소주', 'suzhou', '苏州'],
      },
      { label: '항주', ck: 'china-major', leafKeys: ['hangzhou'], browseCountryLabelForUrl: '항주' },
    ]),
    cn('동북', [
      {
        label: '대련',
        ck: 'china-major',
        leafKeys: ['dalian-harbin'],
        browseCountryLabelForUrl: '대련',
      },
      {
        label: '연길',
        ck: 'china-major',
        browseCountryLabelForUrl: '연길',
        termsOverride: ['연길', 'yanji', '백두산', 'changbai'],
      },
      {
        label: '하얼빈',
        ck: 'china-major',
        browseCountryLabelForUrl: '하얼빈',
        termsOverride: ['하얼빈', 'harbin'],
      },
    ]),
    cn('화북', [
      {
        label: '북경',
        ck: 'china-major',
        browseCountryLabelForUrl: '북경',
        termsOverride: ['북경', 'beijing', '베이징'],
      },
      {
        label: '천진',
        ck: 'china-major',
        browseCountryLabelForUrl: '천진',
        termsOverride: ['천진', 'tianjin', '톈진'],
      },
    ]),
    cn('기타', [
      {
        label: '장가계',
        ck: 'china-major',
        leafKeys: ['zhangjiajie'],
        browseCountryLabelForUrl: '장가계',
      },
      { label: '계림', ck: 'china-major', leafKeys: ['guilin'], browseCountryLabelForUrl: '계림' },
      { label: '성도', ck: 'china-major', leafKeys: ['sichuan'], browseCountryLabelForUrl: '성도' },
    ]),
    megaGroup('홍콩', GK_CN, [
      {
        label: '홍콩',
        ck: 'hk-mo-sz',
        leafKeys: ['hongkong'],
        browseCountryLabelForUrl: '홍콩',
      },
    ]),
    megaGroup('마카오', GK_CN, [
      {
        label: '마카오',
        ck: 'hk-mo-sz',
        leafKeys: ['macau'],
        browseCountryLabelForUrl: '마카오',
      },
    ]),
    megaGroup('몽골', GK_CN, [{ label: '울란바타르', ck: 'mongolia', leafKeys: ['ulaanbaatar'] }]),
  ]
}

/** 괌/사이판/호주/뉴질랜드 */
export function buildOceaniaMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  return [
    megaGroup('괌', GK_GUAM, [{ label: '괌', ck: 'guam', leafKeys: ['guam'], browseCountryLabelForUrl: '괌' }]),
    megaGroup('사이판', GK_GUAM, [
      { label: '사이판', ck: 'saipan', leafKeys: ['saipan'], browseCountryLabelForUrl: '사이판' },
    ]),
    megaGroup('호주', GK_GUAM, [
      { label: '시드니', ck: 'australia', leafKeys: ['sydney'], browseCountryLabelForUrl: '시드니' },
      { label: '멜버른', ck: 'australia', leafKeys: ['melbourne'], browseCountryLabelForUrl: '멜버른' },
    ]),
    megaGroup('뉴질랜드', GK_GUAM, [
      { label: '오클랜드', ck: 'newzealand', leafKeys: ['auckland'], browseCountryLabelForUrl: '오클랜드' },
    ]),
  ]
}

/** 미주/캐나다/하와이 */
export function buildAmericasMegaMenuGroups(): MegaMenuCountryGroupInput[] {
  return [
    megaGroup('미국', GK_AM, [
      {
        label: '로스앤젤레스',
        ck: 'usa-west',
        leafKeys: ['la'],
        browseCountryLabelForUrl: '로스앤젤레스',
      },
      { label: '뉴욕', ck: 'usa-east', leafKeys: ['nyc'], browseCountryLabelForUrl: '뉴욕' },
      {
        label: '샌프란시스코',
        ck: 'usa-west',
        leafKeys: ['sf'],
        browseCountryLabelForUrl: '샌프란시스코',
      },
    ]),
    megaGroup('캐나다', GK_AM, [
      { label: '밴쿠버', ck: 'canada', leafKeys: ['vancouver'], browseCountryLabelForUrl: '밴쿠버' },
      { label: '밴프', ck: 'canada', leafKeys: ['banff'], browseCountryLabelForUrl: '밴프' },
    ]),
    megaGroup('하와이', GK_AM, [
      { label: '호놀룰루', ck: 'hawaii', leafKeys: ['honolulu'], browseCountryLabelForUrl: '호놀룰루' },
    ]),
  ]
}
