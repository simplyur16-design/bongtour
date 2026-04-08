/** 해외여행 서브 랜딩 전용 카피 (메인 허브와 분리) */

export const OVERSEAS_LANDING_SECTIONS = {
  exploreEyebrow: 'Explore',
  exploreTitle: '권역을 고르고, 나라와 목적지를 짚어 보세요',
  exploreLead:
    '하나투어·모두투어 해외 메뉴를 통합한 권역에서 국가·세부 권역을 고른 뒤, 도시·광역 목적지를 선택합니다. 선택 시 아래 일정은 **대표 목적지 → 목적지 원문 → 상품명** 순으로 트리 키워드와 맞춰 좁혀집니다.',

  /** 검색 아래 보조 탐색(경량) */
  exploreAuxEyebrow: 'Quick explore',
  exploreAuxTitle: '빠른 목적지 탐색',
  exploreAuxLead: '검색과 함께 권역 → 국가 → 도시로 범위를 좁힐 수 있습니다.',

  exploreBreadcrumbHint: '현재 필터 기준',
  exploreEmptyTreeTitle: '등록된 해외 일정에 맞는 목적지가 아직 없습니다',
  exploreEmptyTreeLead:
    '공급사에서 가져온 해외·자유여행 일정이 쌓이면, 권역·국가·목적지 칩이 자동으로 열립니다. 지금은 아래 상담 가능 일정·브리핑·추천 탭을 이용하거나 상담으로 희망 지역을 알려 주세요.',
  exploreTreeFootnote: (n: number) =>
    `탐색 트리는 등록된 해외·자유여행 상품 ${n}건과 메타 트리 키워드를 맞춰 활성 노드만 보여 줍니다.`,
  countryShallowOnlyHint:
    '이 국가는 일정이 「국가·세부 권역」 키워드와만 연결되어 있습니다. 아래 「국가 전체」를 눌러 필터하거나 상담으로 세부 도시를 말씀해 주세요.',
  cityPanelTitle: '도시 · 광역 목적지',
  cityHint:
    '목적지 칩을 누르면 「상담 가능 해외 일정」으로 스크롤되며 필터가 적용됩니다. 권역·국가만 고른 상태에서는 아직 필터가 비어 있습니다.',

  typeBranchEyebrow: 'Travel types',
  typeBranchTitle: '어떤 방식으로 떠나시나요?',
  typeBranchLead: '국가·도시 탐색 다음 단계로, 패키지·자유(에어텔)·공급사 일정을 구분해 볼 수 있습니다.',

  packageTitle: '패키지 여행',
  packageBody: '항공·숙박·일정이 묶인 전통 패키지 위주로 공급사 일정을 봅니다.',
  freeTitle: '자유·에어텔',
  freeBody: '항공+호텔·맞춤 일정 성격은 상담에서 일정 골격을 같이 잡습니다.',
  supplierTitle: '공급사별 일정',
  supplierBody: '하나투어·모두투어 등 출처는 카드에 표시됩니다. 비교가 필요하면 상담으로 연결합니다.',

  supplierTabExplainer:
    '등록된 상품의 출처(`originSource`)를 내부 규칙으로 묶어 보여 줍니다. 표기가 조금 달라도 같은 공급사로 인식합니다.',

  editorialEyebrow: 'Editorial',
  editorialTitle: '목적지 브리핑 — 상품과 다른 축',
  editorialLead:
    '아래 카드는 **일정 카드와 톤을 달리**합니다. 왜 이 지역을 짚는지 짧은 맥락만 담고, 구체 일정·요금은 상담에서 공급사 데이터와 맞춥니다. 향후 관리자 입력·도시별 콘텐츠로 확장할 수 있습니다.',

  productFilterHintAll:
    '목적지를 선택하지 않으면 해외 후보 전체가 후보로 올라옵니다. 나라별 탭에서 권역·국가·목적지를 고르면 대표 목적지·원문·상품명 기준으로 좁혀집니다.',
  productFilterHintActive: (label: string) =>
    `선택 경로: ${label} — 트리 키워드가 대표 목적지·목적지 원문·상품명 중 하나와 맞는 일정만 표시합니다.`,

  productLeadSupplierAll: '아래 칩으로 출처(공급사)를 좁힐 수 있습니다.',
  productLeadSupplierSelected: (label: string) =>
    `선택 출처: ${label}. 다른 공급사나 나라별 탐색을 병행해 보세요.`,
  productLeadCurationTab:
    '이 탭에서는 월별 추천 카드가 본체입니다. 아래 일정은 참고용으로, 패키지·자유여행 탭을 함께 보세요.',
  productLeadFreeTab:
    '자유여행·에어텔·항공+호텔 성격 일정은 이 탭에서 먼저 확인합니다. 패키지 탭과 비교해 보세요.',
} as const

export type OverseasEditorialCard = {
  id: string
  tag: string
  title: string
  dek: string
}

/** 샘플 에디토리얼 (추후 CMS / DB) */
export const OVERSEAS_EDITORIAL_SAMPLES: OverseasEditorialCard[] = [
  {
    id: 'ed-tokyo',
    tag: '일본 · 간토',
    title: '왜 지금 도쿄 권을 다시 짚어볼까',
    dek: '환율·항공편·현지 이벤트는 시즌마다 달라집니다. 여기서는 방향만 잡고, 출발일·호텔급은 상담에서 공급사 일정으로 확정합니다.',
  },
  {
    id: 'ed-danang',
    tag: '베트남 · 중부',
    title: '다낭이 다시 주목받는 이유 (한 장 요약)',
    dek: '리조트·골프·가족 단위 수요가 겹치는 구간입니다. 북부(하노이)·남부(호치민)와 동선을 비교할 때 참고하세요.',
  },
  {
    id: 'ed-taipei-spring',
    tag: '대만',
    title: '봄 시즌 타이베이 — 동선만 먼저',
    dek: '벚꽃 전후로 체류일·주말 배치가 요금·혼잡도에 큰 영향을 줍니다. 상담 시 희망 스타일을 알려 주시면 좁혀 드립니다.',
  },
  {
    id: 'ed-europe-city',
    tag: '서유럽',
    title: '유럽 도시 포커스 — 무엇을 먼저 고를까',
    dek: '입국·이동시간·박 수가 일정의 골격입니다. 상품 몰보다 목적(미술·미식·가족)을 정하면 공급사 메뉴와 맞추기 쉬워집니다.',
  },
]
