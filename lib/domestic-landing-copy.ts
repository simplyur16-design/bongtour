/** 국내여행 서브 랜딩 전용 카피 */

import type { DomesticSpecialMode } from '@/lib/domestic-landing-nav-data'

export const DOMESTIC_LANDING_SECTIONS = {
  exploreEyebrow: 'Explore',
  exploreTitle: '권역을 고르고, 지역과 목적지를 짚어 보세요',
  exploreLead:
    '상단 6개 분류(지역·일정·버스·기차·선박·특별테마)로 들어온 뒤, 여기서는 권역 → 지역 → 목적지를 고릅니다. 아래 「상담 가능 일정」 왼쪽 필터로 같은 축을 더 좁힐 수 있습니다.',

  exploreBreadcrumbHint: '현재 필터 기준',
  exploreEmptyTreeTitle: '등록된 국내 일정에 맞는 목적지가 아직 없습니다',
  exploreEmptyTreeLead:
    '공급사 국내 상품이 쌓이면 권역·지역 칩이 자동으로 열립니다. 추천여행·테마 칩·상담으로도 동선을 잡을 수 있습니다.',

  exploreTreeFootnote: (n: number) =>
    `탐색 트리는 국내로 분류된 상품 ${n}건과 메타 키워드를 맞춰 활성 노드만 보여 줍니다.`,

  areaShallowOnlyHint:
    '이 지역은 상품이 지역·코스 키워드와만 연결되어 있습니다. 「지역 전체」를 눌러 필터하거나 상담으로 세부 목적지를 알려 주세요.',

  cityPanelTitle: '도시 · 섬 · 테마',
  cityHint: '목적지 칩을 누르면 「상담 가능 국내 일정」으로 스크롤되며 필터가 적용됩니다.',

  themeTabExplainer:
    '버스·기차·당일·박 수·특수 테마 등 상품명에 자주 붙는 키워드로 좁힙니다. 지역별 탭과 함께 쓰면 교차 필터(AND)로 동작합니다.',

  productFilterHintAll:
    '지역을 선택하지 않으면 국내 후보 전체가 올라옵니다. 권역·지역·목적지를 고르면 메타 필드·제목과 맞춰 좁혀집니다.',
  productFilterHintActive: (label: string) => `선택 경로: ${label}`,

  productLeadSupplierAll: '아래 칩으로 출처(공급사)를 좁힐 수 있습니다.',
  productLeadSupplierSelected: (label: string) => `선택 출처: ${label}.`,
  productLeadCurationTab: '이 탭에서는 월별 국내 추천 카드가 본체입니다. 아래 일정은 참고용입니다.',
  productLeadThemeTab: '테마·여행 방식 칩으로 상품명 키워드를 좁힙니다. 지역 필터와 동시에 적용됩니다.',

  productLeadSpecials: (mode: DomesticSpecialMode) => {
    const map: Record<DomesticSpecialMode, string> = {
      popular: '특별기획 · 인기상품 기준으로 후보를 보고 있습니다.',
      closing: '특별기획 · 출발 임박 일정만 좁혀 보고 있습니다.',
      season: '특별기획 · 시즌 키워드가 있는 일정을 보고 있습니다. 월별 추천 카드와 함께 보시면 좋습니다.',
      value: '특별기획 · 참고가 부담 적은 후보 위주로 좁혀 보고 있습니다.',
      consult: '특별기획 · 상담·문의 톤이 있는 일정을 보고 있습니다.',
    }
    return map[mode]
  },
} as const

export type DomesticEditorialCard = {
  id: string
  tag: string
  title: string
  dek: string
}

export const DOMESTIC_EDITORIAL_SAMPLES: DomesticEditorialCard[] = [
  {
    id: 'dm-suwon',
    tag: '수원',
    title: '수원 방문의 해 — 성곽과 행궁을 한 번에',
    dek: '화성·행궁 동선은 계절·주말 혼잡도가 다릅니다. 상품 몰 전에 왜 지금 수원인지 짧게 짚고, 일정은 상담에서 맞춥니다.',
  },
  {
    id: 'dm-jeonju',
    tag: '전주',
    title: '봄의 전주 한옥 — 체류일만 먼저',
    dek: '야경·미식·가족 단위에 따라 숙박 구역이 갈립니다. 브리핑은 맥락만, 요금·출발은 공급사 일정으로 확정합니다.',
  },
  {
    id: 'dm-yeosu',
    tag: '여수',
    title: '지금 여수를 보는 짧은 이유',
    dek: '밤바다·케이블카·섬 연계는 시즌별로 동선이 달라집니다. 테마여행 탭의 「특수 테마」와 병행해 보세요.',
  },
  {
    id: 'dm-gyeongju-fall',
    tag: '경주',
    title: '가을 경주 포커스',
    dek: '불국사·첨성대·대릉원 일대는 체류·이동시간 설계가 일정의 골격입니다. 경상 권역 칩과 연결해 보세요.',
  },
  {
    id: 'dm-islands',
    tag: '섬여행',
    title: '섬 노선 특집 — 풍랑·운항 안내',
    dek: '섬 일정은 기상·운항에 민감합니다. 상품 카드와 별도로, 이 축에서는 리스크와 준비 포인트만 짧게 안내합니다.',
  },
]
