/**
 * 국내여행 랜딩 1·2차 메뉴 SSOT.
 * — regionSecond.groupKey 는 `DOMESTIC_LOCATION_TREE_DATA` 의 groupKey 와 맞춘다.
 */

export type DomesticPillarId = 'region' | 'schedule' | 'bus' | 'train' | 'ship' | 'special_theme'

/** 갤러리 refine 등 레거시 — 상단 메뉴와 분리 */
export type DomesticSpecialMode = 'popular' | 'closing' | 'season' | 'value' | 'consult'

export type DomesticRegionSecondItem = {
  key: string
  label: string
  groupKey?: string
  destinationTerms?: string[]
  absorbNote?: string
}

export type DomesticTermSecondItem = {
  key: string
  label: string
  /** browse 약한 문자열 보조(제목 파싱 실패 시) */
  terms: string[]
  absorbNote?: string
}

export type DomesticSpecialThemeSecondItem = {
  key: string
  label: string
  description: string
}

export const DOMESTIC_NAV_PILLARS: {
  id: DomesticPillarId
  label: string
  shortWhy: string
  regionSecond?: DomesticRegionSecondItem[]
  termSecond?: DomesticTermSecondItem[]
  specialThemeSecond?: DomesticSpecialThemeSecondItem[]
}[] = [
  {
    id: 'region',
    label: '지역별 여행',
    shortWhy: '제목·권역 메타를 우선해 목적지를 고릅니다.',
    regionSecond: [
      { key: 'jeju', label: '제주', groupKey: 'jeju', absorbNote: '구 「제주도」' },
      { key: 'gangwon', label: '강원', groupKey: 'gangwon' },
      { key: 'chungcheong', label: '충청', groupKey: 'chungcheong' },
      { key: 'jeolla', label: '전라', groupKey: 'jeolla' },
      { key: 'gyeongsang', label: '경상', groupKey: 'gyeongsang' },
      { key: 'capital', label: '수도권', groupKey: 'capital', absorbNote: '구 수도권·경기 묶음' },
      {
        key: 'ulleung',
        label: '울릉/독도',
        destinationTerms: ['울릉', '울릉도', '독도'],
        absorbNote: '구 흩어진 울릉 메뉴 → 지역축',
      },
      { key: 'islands', label: '섬여행', groupKey: 'islands', absorbNote: '구 「섬여행」·도서 노선' },
    ],
  },
  {
    id: 'schedule',
    label: '일정별 여행',
    shortWhy: '제목의 N박M일·당일·무박·M일 패턴을 우선합니다.',
    termSecond: [
      { key: 'day', label: '당일', terms: ['당일여행', '당일', '당일치기'] },
      { key: 'mubak', label: '무박', terms: ['무박', '무박 2일'] },
      { key: 'n1', label: '1박2일', terms: ['1박2일', '1박 2일'] },
      { key: 'n2', label: '2박3일', terms: ['2박3일', '2박 3일'] },
      { key: 'n3p', label: '3박4일 이상', terms: ['3박4일', '3박 4일', '4박5일', '장기'] },
      { key: 'nd3', label: '3일', terms: ['3일'] },
      { key: 'nd4', label: '4일', terms: ['4일'] },
      { key: 'weekend', label: '주말출발', terms: ['주말', '토요일', '일요일', '금요일출발'] },
      { key: 'weekday', label: '평일출발', terms: ['평일', '월요일', '화요일', '수요일', '목요일'] },
    ],
  },
  {
    id: 'bus',
    label: '버스여행',
    shortWhy: '상품명·포함문구에서 버스·관광버스 등을 찾습니다.',
    termSecond: [{ key: 'all', label: '버스여행', terms: [] }],
  },
  {
    id: 'train',
    label: '기차여행',
    shortWhy: 'KTX·열차·철도 등 기차 키워드로 찾습니다.',
    termSecond: [{ key: 'all', label: '기차여행', terms: [] }],
  },
  {
    id: 'ship',
    label: '선박여행(크루즈)',
    shortWhy: '크루즈·유람선·페리·여객선 등 해상 이동·체험이 제목에 드러난 상품을 찾습니다.',
    termSecond: [{ key: 'all', label: '선박여행', terms: [] }],
  },
  {
    id: 'special_theme',
    label: '특별테마',
    shortWhy: '운영자가 displayCategory에 직접 표기한 상품만 노출합니다.',
    specialThemeSecond: [
      {
        key: 'curated',
        label: '특별테마 상품',
        description: '관리자 displayCategory에 「국내특별테마」가 포함된 경우만 목록에 나옵니다.',
      },
    ],
  },
]

/** URL `dmPillar` / `dmItem` → 초기 탐색 상태 (서버·클라 공통) */
export function parseDomesticUrlNav(
  dmPillar: string | undefined,
  dmItem: string | undefined
):
  | { kind: 'region'; groupKey?: string; destinationTerms?: string[]; summaryLabel: string }
  | { kind: 'terms'; pillar: 'schedule' | 'bus' | 'train' | 'ship'; terms: string[]; summaryLabel: string }
  | { kind: 'special_theme'; secondKey: string; summaryLabel: string }
  | null {
  if (!dmPillar || !dmItem) return null
  const pillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === dmPillar)
  if (!pillar) return null
  if (pillar.id === 'region') {
    const item = pillar.regionSecond?.find((r) => r.key === dmItem)
    if (!item) return null
    return {
      kind: 'region',
      groupKey: item.groupKey,
      destinationTerms: item.destinationTerms,
      summaryLabel: item.label,
    }
  }
  if (pillar.id === 'special_theme') {
    const item = pillar.specialThemeSecond?.find((s) => s.key === dmItem)
    if (!item) return null
    return {
      kind: 'special_theme',
      secondKey: item.key,
      summaryLabel: item.label,
    }
  }
  if (pillar.id === 'schedule' || pillar.id === 'bus' || pillar.id === 'train' || pillar.id === 'ship') {
    const item = pillar.termSecond?.find((t) => t.key === dmItem)
    if (!item) return null
    return { kind: 'terms', pillar: pillar.id, terms: item.terms, summaryLabel: item.label }
  }
  return null
}
