/**
 * 메인 허브 전용 카피. 법적 고지 본문은 `bongtour-copy` + 하단 `BongtourDisclosureBlock`.
 */

import { homeHubCardImageSrc } from '@/lib/home-hub-images'

// ─── 메인 Compact Hero (브랜드 인트로만; 상품·CTA 버튼 없음) ────────────────

export const MAIN_HERO_EYEBROW = 'BONGTOUR'

/** 브랜드 슬로건 — 시각적 h1 */
export const MAIN_HERO_BRAND_SLOGAN = '여정의 시작부터 현장의 언어까지'

/** 메인 카피 1문장 */
export const MAIN_HERO_MAIN_COPY = '여행은 검증된 상품으로, 국외연수는 목적에 맞는 기획으로.'

/** 보조 설명 */
export const MAIN_HERO_SUB_COPY =
  '패키지·자유여행 상담부터 기관 섭외, 통역, 이동 운영까지 필요한 방식으로 여정을 연결합니다.'

/** 텍스트 링크형 보조 CTA */
export const MAIN_HERO_AUX_LINK_LABEL = '4개 영역 살펴보기'
export const MAIN_HERO_AUX_LINK_HREF = '#hub-four'

/** 레거시 호환(다른 페이지·문서 참조 시) */
export const MAIN_HERO_HEADLINE = MAIN_HERO_BRAND_SLOGAN
export const MAIN_HERO_SUBLINE = MAIN_HERO_MAIN_COPY

export const MAIN_HERO_DISCLAIMER_LINE =
  '즉시 결제·자동 확정이 아닌 상담·접수 창구입니다. 세부 조건은 확인 과정에서 정리됩니다.'

export const MAIN_HERO_CTA_PRIMARY_LABEL = '상담으로 시작하기'
export const MAIN_HERO_CTA_SECONDARY_LABEL = '4개 영역 보기'

/** Hero 직하단 정보 바 — 역량 스캔용 짧은 라벨 */
export const MAIN_HERO_INFO_STRIP = [
  { label: '공급사 상담', hint: '일정·요금 해석' },
  { label: '기관 섭외', hint: '현지 방문·교류' },
  { label: '통역', hint: '순차 · 동시' },
  { label: '직영 차량', hint: '전세 · 동선' },
] as const

/** 피처 상품 스트립 제목 */
export const MAIN_HERO_FEATURED_STRIP_LABEL = '상담 가능 일정 · 공급사 안내'

// ─── 신뢰 밴드 (짧은 리드 + 3카드) ─────────────────────────────────────────

export const MAIN_TRUST_TITLE = 'Bong투어의 역할'

export const MAIN_TRUST_LEAD =
  '공급사 안내를 바탕으로 상담·접수를 돕고, 섭외·통역·전세 실행은 같은 흐름에서 맞춥니다. 최종 조건은 공급사 확인 후 정리됩니다. 상세 고지는 하단 참고.'

export const MAIN_TRUST_HIGHLIGHTS = [
  {
    title: '목적과 틀',
    body: '가족 여행부터 기관·단체 연수까지, 먼저 목적과 일정 골격을 상담으로 맞춥니다.',
  },
  {
    title: '정보 해석',
    body: '화면의 일정·요금은 공급사(여행사) 안내를 바탕으로 하며, 세부는 확인 과정에서 차근히 정리합니다.',
  },
  {
    title: '현장 실행',
    body: '기관 방문 섭외, 미팅·행사 통역, 공항·행사장 전세 등 운영 레이어가 필요할 때 직접 맞춥니다.',
  },
] as const

// ─── 월별 큐레이션 섹션 ─────────────────────────────────────────────────────

export const MAIN_CURATION_EYEBROW = 'Monthly curation'
export const MAIN_CURATION_TITLE = '이번 달 추천 브리핑'
export const MAIN_CURATION_LEAD =
  '운영팀이 직접 고른 목적지와 맥락입니다. 카드는 상품 진열이 아니라 상담용 초안이에요.'

export const MAIN_CURATION_DOMESTIC_DESC = '국내 목적지·단기 일정 위주.'
export const MAIN_CURATION_OVERSEAS_DESC =
  '해외 패키지·자유(에어텔) 성격 카드가 함께 올 수 있습니다. 구분은 상담에서 맞춥니다.'

// ─── 브리핑 ─────────────────────────────────────────────────────────────────

export const MAIN_BRIEFING = {
  title: '브리핑 예시 · 4일 타임라인',
  subtitle:
    '가상 시나리오입니다. 공급사 일정과 Bong투어 운영이 맞물리는 그림을 상담에서 같이 그려 봅니다.',
  scenario: '기관 연수 + 현지 대학·연구기관 방문 + 통역 + 단체 이동이 맞물리는 4일 구성',
  closing: '공급사 캘린더와 Bong투어 운영(섭외·통역·차량)이 어디에서 만나는지, 단계마다 짚어 드립니다.',
  days: [
    {
      day: '1일차',
      focus: '도착·오리엔테이션',
      note: '입국 직후 미팅 포인트와 연락망·통역 채널을 정리해 두면 이후 일정이 수월해집니다.',
    },
    {
      day: '2일차',
      focus: '기관 방문·세션',
      note: '대학·연구기관 등 사전 조율된 방문 일정에 맞춰 순차·동시 통역 방식을 맞춥니다.',
    },
    {
      day: '3일차',
      focus: '현장·워크숍',
      note: '벤치마킹·현장 설명이 이어지는 날에는 전세·지정 차량으로 동선을 묶어 이동 변수를 줄입니다.',
    },
    {
      day: '4일차',
      focus: '정리·출발',
      note: '레슨런드와 후속 연락 창구를 정리하고, 항공·공급사 일정과 맞춰 마무리합니다.',
    },
  ],
} as const

// ─── 강점 4카드 (실제 상황 중심, 길이 균형) ─────────────────────────────────

export const MAIN_STRENGTHS_SECTION_TITLE = '실무에서 쓰이는 역량'
export const MAIN_STRENGTHS_SECTION_LEAD = '일정표 너머에서 필요해지는 지점을 짧게 정리했습니다.'

export const MAIN_STRENGTHS = [
  {
    key: 'curation',
    title: '맞춤형 여행 큐레이션',
    body: '인원·시즌·예산·리스크를 같이 보며 공급사 후보를 좁힙니다. “이 조건이면 이 루트”를 상담에서 고정합니다.',
  },
  {
    key: 'institution',
    title: '현지 연수기관 직접 섭외',
    body: '대학·연구기관·기업·공공 방문이 필요할 때 현지 컨택·일정·서류를 단계별로 맞춥니다.',
  },
  {
    key: 'interpretation',
    title: '순차통역 · 동시통역',
    body: '미팅·세미나·포럼·현장 설명에 맞춰 형식과 인력을 정하고, 일정에 동행합니다.',
  },
  {
    key: 'bus',
    title: '직영 전세버스 운영',
    body: '공항·호텔·행사장·워크숍 동선을 전세로 묶어 탑승과 변수를 관리합니다.',
  },
] as const

// ─── 문의 유형 (실사용 시나리오 한 줄) ─────────────────────────────────────

export const MAIN_INQUIRY_SECTION_EYEBROW = '서비스 선택'
export const MAIN_INQUIRY_SECTION_TITLE = '어떤 지원이 필요하신가요?'
export const MAIN_INQUIRY_SECTION_LEAD = '하나만 골라도 됩니다. 여러 이슈가 겹치면 상담에서 한 번에 묶습니다.'

export const MAIN_INQUIRY_TYPES = [
  {
    type: 'travel' as const,
    whenToPick: '가족·커플·소그룹 여행을 구상 중일 때',
    title: '일반 여행 상담',
    blurb: '일정 후보와 공급사 상품을 함께 고르고, 우선순위를 정리합니다.',
    ctaVariant: 'consult' as const,
  },
  {
    type: 'institution' as const,
    whenToPick: '해외 기관 방문·교류 일정이 필요할 때',
    title: '연수기관 섭외 문의',
    blurb: '대학·연구기관·기업 방문 섭외 가능 범위와 일정 창부터 상담합니다.',
    ctaVariant: 'consult' as const,
  },
  {
    type: 'training' as const,
    whenToPick: '기업·기관 단위 연수·벤치마킹을 준비할 때',
    title: '국외연수 견적 문의',
    blurb: '인원·기간·과제에 맞춰 견적과 서류 흐름을 설계합니다.',
    ctaVariant: 'customItinerary' as const,
  },
  {
    type: 'bus' as const,
    whenToPick: '행사·워크숍·단체 이동에 차량이 필요할 때',
    title: '전세버스 견적 문의',
    blurb: '노선·시간·인원에 맞는 차량과 직영 운영 기준으로 동선을 제안합니다.',
    ctaVariant: 'consult' as const,
  },
] as const

// ─── 메인 4축 허브 (2×2) — 실질적 메인 Hero; 짧은 헤드카피만(긴 슬로건은 서브로) ─

export const MAIN_HUB_FOUR_SR_HEADING = 'Bong투어 주요 서비스 영역'

export type HubFourAccent = 'domestic' | 'overseas' | 'training' | 'bus'

/** 그리드 순서: 해외여행 → 국외연수 → 국내여행 → 전세버스 — headline은 짧은 헤드카피(모바일 기본·데스크톱 hover) */
export const MAIN_HUB_FOUR_CARDS = [
  {
    key: 'overseas',
    href: '/travel/overseas',
    accent: 'overseas' as const,
    categoryLabel: '해외여행',
    headline: '검증된 세계로',
    description:
      '주요 여행사 베스트 상품을 바탕으로 패키지와 자유여행(에어텔)을 상담합니다.',
    hints: ['패키지', '자유여행', '에어텔'] as const,
    ctaLabel: '해외여행 보기',
    imageSrc: homeHubCardImageSrc('overseas'),
  },
  {
    key: 'training',
    href: '/training',
    accent: 'training' as const,
    categoryLabel: '국외연수',
    headline: '목적형 연수 설계',
    description:
      '정부·공공·기업 목적에 맞춰 기관 섭외와 통역, 이동 운영까지 처음부터 설계합니다.',
    hints: ['정부·공공', '기업', '기관섭외'] as const,
    ctaLabel: '국외연수 보기',
    imageSrc: homeHubCardImageSrc('training'),
  },
  {
    key: 'domestic',
    href: '/travel/domestic',
    accent: 'domestic' as const,
    categoryLabel: '국내여행',
    headline: '대한민국의 재발견',
    description:
      '취향 스테이, 계절 여행, 단체·워크숍 일정까지 국내 여정을 더 정교하게 제안합니다.',
    hints: ['추천여행', '지역별', '단체·워크숍'] as const,
    ctaLabel: '국내여행 보기',
    imageSrc: homeHubCardImageSrc('domestic'),
  },
  {
    key: 'bus',
    href: '/charter-bus',
    accent: 'bus' as const,
    categoryLabel: '전세버스',
    headline: '6인승부터 45인승까지',
    description:
      '행사·연수·공항 이동까지 인원과 목적에 맞는 차량을 직영 운영 기준으로 제안합니다.',
    hints: ['공항 이동', '행사 운영', '단체 이동'] as const,
    ctaLabel: '전세버스 보기',
    imageSrc: homeHubCardImageSrc('bus'),
  },
] as const

// ─── Quick Entry (레거시; 허브로 대체) ─────────────────────────────────────

export const MAIN_QUICK_ENTRY_EYEBROW = '빠른 진입'
export const MAIN_QUICK_ENTRY_TITLE = '어디부터 살펴볼까요?'
export const MAIN_QUICK_ENTRY_LEAD = '목적에 맞는 영역으로 바로 이동합니다.'

export const MAIN_QUICK_ENTRIES = [
  {
    key: 'domestic',
    title: '국내여행',
    blurb: '단기·근거리 일정',
    hint: '월별 추천 · 상품 예시',
    href: '/#pick-domestic',
  },
  {
    key: 'package',
    title: '해외 패키지',
    blurb: '일정·가이드 중심',
    hint: '상담 가능 일정',
    href: '/#pick-package',
  },
  {
    key: 'free',
    title: '자유·에어텔',
    blurb: '항공+호텔·맞춤 일정',
    hint: '성격은 상담에서 구분',
    href: '/#pick-free',
  },
  {
    key: 'training',
    title: '국외연수',
    blurb: '단체·기관 프로그램',
    hint: '흐름·견적 안내',
    href: '/#support-training',
  },
  {
    key: 'bus',
    title: '전세버스',
    blurb: '직영·동선 관리',
    hint: '견적·이용 순서',
    href: '/#support-bus',
  },
] as const

// ─── 상담 가능 상품 예시 (탭) ─────────────────────────────────────────────

export const MAIN_PRODUCT_PICK_EYEBROW = 'Reference itineraries'
export const MAIN_PRODUCT_PICK_TITLE = '상담 가능 상품 예시'
export const MAIN_PRODUCT_PICK_LEAD =
  '실제 공급사 상품입니다. OTA가 아니라 Bong투어 해석 레이어에서 참고용으로 보여 드립니다. 요금·일정은 상담 시 확인해 주세요.'

export const MAIN_PRODUCT_PICK_FOOTNOTE =
  '분류는 상품명 키워드 기준 자동 추정입니다. 원하시는 유형이 보이지 않으면 상담으로 말씀해 주세요.'

// ─── 해외/국내 랜딩 (1차 스캐폴딩 카피) ─────────────────────────────────────

export const TRAVEL_OVERSEAS_HERO = {
  eyebrow: 'OVERSEAS TRAVEL',
  title: '검증된 세계를 만나는 품격 있는 방법',
  lead:
    '목적지·상품명·출발일·가격대를 검색하거나, 아래 지역 메뉴에서 바로 탐색하세요. 검색만 강조하지 않고 메뉴 탐색과 균형을 맞췄습니다.',
} as const

export const TRAVEL_OVERSEAS_PRODUCT_TITLE = '상담 가능 해외 일정'
export const TRAVEL_OVERSEAS_PRODUCT_LEAD =
  '실제 공급사 상품입니다. 참고용이며 요금·출발은 상담 시 확인해 주세요.'

export const TRAVEL_DOMESTIC_HERO = {
  eyebrow: 'Domestic Travel',
  title: '익숙한 풍경에서 발견하는 낯선 감동',
  lead:
    '취향이 담긴 스테이부터 계절의 정점을 찍는 테마 일정까지. Bong투어가 대한민국의 여행지를 더 정교하게 제안합니다.',
} as const

export const TRAVEL_DOMESTIC_PRODUCT_TITLE = '상담 가능 국내 일정'
export const TRAVEL_DOMESTIC_PRODUCT_LEAD =
  '실제 공급사 상품입니다. 참고용이며 요금·출발은 상담 시 확인해 주세요.'

export const TRAINING_PAGE_HERO = {
  eyebrow: '국외연수',
  title: '단순 방문을 넘어 목적의 성과로',
  lead: '여행 상품 나열이 아니라, 기관·단체 프로그램 설계와 직접 섭외 중심 상담입니다.',
} as const

export const TRAINING_PUBLIC_LABEL = '정부·공공 연수'
export const TRAINING_CORPORATE_LABEL = '기업 연수'

export const CHARTER_BUS_HERO = {
  eyebrow: '전세버스',
  title: '이동의 가치를 완성하는 직영 시스템',
  lead: '공항·행사·연수·기관 방문 등 목적에 맞춰 동선과 차량을 제안합니다. 견적은 상담으로 접수합니다.',
} as const

// ─── 얇은 강점 바 (상세는 지원 선택 패널로) ───────────────────────────────

export const MAIN_STRENGTH_STRIP_ITEMS = [
  { label: '큐레이션', sub: '인원·리스크까지 맞춤' },
  { label: '직접 섭외·통역', sub: '기관 방문·행사 동행' },
  { label: '직영 전세', sub: '공항·행사 동선' },
] as const

// ─── 지원 유형 + 패널 상세 (강점·문의 통합) ─────────────────────────────────

export const MAIN_SUPPORT_SECTION_EYEBROW = '맞춤 안내'
export const MAIN_SUPPORT_SECTION_TITLE = '어떤 지원이 필요하신가요?'
export const MAIN_SUPPORT_SECTION_LEAD = '유형을 누르면 진행 방식과 상담 흐름이 펼쳐집니다.'

export type MainSupportInquiryKey = 'travel' | 'institution' | 'training' | 'bus'

export const MAIN_SUPPORT_PANELS: Record<
  MainSupportInquiryKey,
  {
    title: string
    tagline: string
    when: string
    how: string[]
    flow: string[]
    differentiator: string
    inquiryPath: string
  }
> = {
  travel: {
    title: '일반 여행 상담',
    tagline: '가족·소그룹·일반 패키지',
    when: '출발 시기와 예산 감만 잡혀 있을 때',
    how: [
      '공급사 상품 후보를 좁히고 일정·우선순위를 정리합니다.',
      '국내·해외·자유 성격은 상담에서 함께 나눕니다.',
    ],
    flow: ['문의 접수 → 담당자 연락 → 일정·상품 조율 → 공급사 조건 확인'],
    differentiator: '특가 나열이 아니라, 맞는 일정을 고르는 상담입니다.',
    inquiryPath: '/inquiry?type=travel',
  },
  institution: {
    title: '연수기관 섭외 문의',
    tagline: '랜드사 전달이 아닌, 니즈 기반 직접 섭외',
    when: '해외 대학·연구기관·기업 캠퍼스 방문이 필요할 때',
    how: [
      '교류 목적·인원·일정에 맞춰 현지 기관 컨택과 일정 조율을 진행합니다.',
      '가능 범위·리드타임을 먼저 투명하게 짚습니다.',
    ],
    flow: ['접수 → 요구사항 정리 → 섭외 방향 제안 → 일정 초안 → 실행 단계 안내'],
    differentiator: '단순 중개가 아니라, 방문 가능성과 일정 현실성을 같이 봅니다.',
    inquiryPath: '/inquiry?type=institution',
  },
  training: {
    title: '국외연수 견적 문의',
    tagline: '프로그램·서류·비용 설계',
    when: '기업·기관 단위 연수·벤치마킹을 준비할 때',
    how: [
      '인원·기간·과제에 맞춰 견적 구조와 서류 흐름을 단계별로 설계합니다.',
      '현지 일정과 Bong투어 운영(통역·차량) 연결 지점을 안내합니다.',
    ],
    flow: ['접수 → 요구 정리 → 견적·일정 초안 → 검토 → 공급사·현지 조건 반영'],
    differentiator: '견적만이 아니라, 실행 가능한 일정 골격까지 같이 잡습니다.',
    inquiryPath: '/inquiry?type=training',
  },
  bus: {
    title: '전세버스 견적 문의',
    tagline: '직영 운영 기준 · 동선·시간 관리',
    when: '행사·워크숍·단체 픽업·구간 이동이 필요할 때',
    how: [
      '노선·시간·인원·수하물을 반영해 차량 규격과 동선을 제안합니다.',
      '탑승 포인트와 변수를 줄이는 운영에 맞춥니다.',
    ],
    flow: ['접수 → 동선·시간 확인 → 견적 → 배차·확정 단계 안내'],
    differentiator: '알선만이 아니라, 직영·지정 기준으로 동선을 묶어 드립니다.',
    inquiryPath: '/inquiry?type=bus',
  },
}

// ─── 갤러리 밴드 (레거시 문구 — 탭 섹션으로 대체됨) ─────────────────────────

export const MAIN_GALLERY_TITLE = '상담 가능 일정 · 참고'
export const MAIN_GALLERY_LEAD =
  '메인의 보조 섹션입니다. 분위기와 일정 감만 보시고, 조건은 반드시 상담에서 확인해 주세요.'

// ─── 하단 CTA ─────────────────────────────────────────────────────────────

export const MAIN_BOTTOM_CTA = {
  title: '먼저 편하게 남겨 주세요',
  subtitle:
    '유형이 애매하면 일반 여행 상담으로 적어 주셔도 됩니다. 담당자가 내용을 보고 연락드립니다.',
} as const

// ─── 메인 최소 푸터 (전역 긴 푸터 없음) ─────────────────────────────────────

export const MAIN_MINIMAL_FOOTER_TAGLINE = 'Bong투어 BongTour'

export const MAIN_MINIMAL_FOOTER_NOTE =
  '상세 사업자 정보·고지는 각 서비스 페이지 하단에서 확인할 수 있습니다.'

export const MAIN_MINIMAL_FOOTER_LINKS = [
  { label: '해외여행', href: '/travel/overseas' },
  { label: '국외연수', href: '/training' },
  { label: '국내여행', href: '/travel/domestic' },
  { label: '전세버스', href: '/charter-bus' },
  { label: '항공권 예매 및 발권', href: '/air-ticketing' },
  { label: '봉투어 소개', href: '/#site-about' },
  { label: '고객지원', href: '/support' },
  { label: '개인정보처리방침', href: '/privacy' },
  { label: '이용약관', href: '/terms' },
] as const
