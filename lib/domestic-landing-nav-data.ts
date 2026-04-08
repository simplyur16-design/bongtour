/**
 * 국내여행 랜딩 1·2차 메뉴 SSOT.
 * — 상단 메뉴: 탐색 진입(넓은 집합). 좌측 필터: 동일 축의 정교한 좁히기.
 * — regionSecond.groupKey 는 `DOMESTIC_LOCATION_TREE_DATA` 의 groupKey 와 맞춘다.
 */

export type DomesticPillarId = 'region' | 'schedule' | 'theme' | 'audience' | 'specials'

export type DomesticSpecialMode = 'popular' | 'closing' | 'season' | 'value' | 'consult'

export type DomesticRegionSecondItem = {
  key: string
  label: string
  /** location tree 의 권역 키 — 매칭 시 그룹 전체 토큰 사용 */
  groupKey?: string
  /** 트리에 없는 지역(울릉 등) 전용 */
  destinationTerms?: string[]
  absorbNote?: string
}

export type DomesticTermSecondItem = {
  key: string
  label: string
  /** 상품명·목적지·themeTags OR 매칭용 토큰 */
  terms: string[]
  absorbNote?: string
}

export type DomesticSpecialSecondItem = {
  key: DomesticSpecialMode
  label: string
  description: string
  scrollTo?: 'curation'
}

export const DOMESTIC_NAV_PILLARS: {
  id: DomesticPillarId
  label: string
  shortWhy: string
  regionSecond?: DomesticRegionSecondItem[]
  termSecond?: DomesticTermSecondItem[]
  specialSecond?: DomesticSpecialSecondItem[]
}[] = [
  {
    id: 'region',
    label: '지역별 여행',
    shortWhy: '목적지 축만 한 레벨에 모아 제주·섬·수도권 등을 한곳에서 고른다.',
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
    shortWhy: '몇 박·언제 출발인지 먼저 고르는 사용자 동선.',
    termSecond: [
      { key: 'day', label: '당일여행', terms: ['당일여행', '당일', '당일치기'] },
      { key: 'n1', label: '1박2일', terms: ['1박2일', '1박 2일'] },
      { key: 'n2p', label: '2박3일 이상', terms: ['2박3일', '2박 3일', '3박4일', '3박 4일', '장기'] },
      { key: 'weekend', label: '주말출발', terms: ['주말', '토요일', '일요일', '금요일출발'] },
      { key: 'weekday', label: '평일출발', terms: ['평일', '월요일', '화요일', '수요일', '목요일'] },
    ],
  },
  {
    id: 'theme',
    label: '테마별 여행',
    shortWhy: '목적지가 아니라 경험·활동으로 찾는 축(골프·축제·기차 등).',
    termSecond: [
      { key: 'festival', label: '축제여행', terms: ['축제', '축제여행', '페스티벌'] },
      { key: 'food', label: '미식여행', terms: ['미식', '맛집', '음식', '식도락'] },
      { key: 'train', label: '기차여행', terms: ['기차여행', 'KTX', 'ktx', '철도', '열차', '관광열차'] },
      { key: 'trek', label: '트레킹/걷기', terms: ['트레킹', '등산', '걷기', '둘레길'] },
      { key: 'heal', label: '힐링/온천', terms: ['힐링', '온천', '스파', '휴양'] },
      { key: 'sea', label: '바다/유람선', terms: ['유람선', '크루즈', '바다', '해안'] },
      { key: 'season', label: '계절특선', terms: ['봄', '여름', '가을', '겨울', '단풍', '벚꽃', '설경'] },
      { key: 'golf', label: '국내골프', terms: ['골프', '국내골프', '골프여행'] },
    ],
  },
  {
    id: 'audience',
    label: '대상별 여행',
    shortWhy: '누구와 가는지(가족·단체 등)로 묶어 공급사 톤을 사용자어로 통일.',
    termSecond: [
      { key: 'filial', label: '효도여행', terms: ['효도', '부모님', '실버', '어르신', '시니어'] },
      { key: 'family', label: '가족여행', terms: ['가족', '가족여행', '자녀', '키즈'] },
      { key: 'couple', label: '커플여행', terms: ['커플', '신혼', '기념일'] },
      { key: 'friends', label: '친구모임', terms: ['친구', '지인', '동창'] },
      { key: 'corporate', label: '단체/워크샵', terms: ['단체', '워크샵', '기업', '기관', 'MICE', '세미나'] },
      { key: 'club', label: '동호회/산악회', terms: ['동호회', '산악회', '밴드', '동아리', '모임'] },
    ],
  },
  {
    id: 'specials',
    label: '특별기획',
    shortWhy: '운영·전환에 쓰는 큐레이션 축(인기·마감·가성비 등).',
    specialSecond: [
      { key: 'popular', label: '인기상품', description: '최근 등록·갱신 순 노출에 맞춤' },
      { key: 'closing', label: '마감임박', description: '출발일 임박 일정만' },
      { key: 'season', label: '시즌추천', description: '계절·행사 키워드 가중', scrollTo: 'curation' },
      { key: 'value', label: '가성비상품', description: '참고가 낮은 순·상한 조합' },
      { key: 'consult', label: '상담많은상품', description: '문의·상담 톤 키워드(등록 데이터 기준)' },
    ],
  },
]

/** URL `dmPillar` / `dmItem` → 초기 탐색 상태 (서버·클라 공통) */
export function parseDomesticUrlNav(
  dmPillar: string | undefined,
  dmItem: string | undefined
):
  | { kind: 'region'; groupKey?: string; destinationTerms?: string[]; summaryLabel: string }
  | { kind: 'terms'; pillar: 'schedule' | 'theme' | 'audience'; terms: string[]; summaryLabel: string }
  | { kind: 'special'; mode: DomesticSpecialMode; summaryLabel: string; scrollTo?: 'curation' }
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
  if (pillar.id === 'specials') {
    const item = pillar.specialSecond?.find((s) => s.key === dmItem)
    if (!item) return null
    return {
      kind: 'special',
      mode: item.key,
      summaryLabel: item.label,
      scrollTo: item.scrollTo,
    }
  }
  if (pillar.id === 'schedule' || pillar.id === 'theme' || pillar.id === 'audience') {
    const item = pillar.termSecond?.find((t) => t.key === dmItem)
    if (!item) return null
    return { kind: 'terms', pillar: pillar.id, terms: item.terms, summaryLabel: item.label }
  }
  return null
}

/** 빠른 칩(히어로) — 예시 고정 */
export const DOMESTIC_HERO_QUICK_CHIPS: { label: string; pillar: DomesticPillarId; secondKey: string }[] = [
  { label: '당일여행', pillar: 'schedule', secondKey: 'day' },
  { label: '1박2일', pillar: 'schedule', secondKey: 'n1' },
  { label: '제주', pillar: 'region', secondKey: 'jeju' },
  { label: '효도여행', pillar: 'audience', secondKey: 'filial' },
  { label: '축제여행', pillar: 'theme', secondKey: 'festival' },
  { label: '단체여행', pillar: 'audience', secondKey: 'corporate' },
]
