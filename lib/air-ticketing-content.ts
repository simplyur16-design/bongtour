/**
 * 항공권 예매 및 발권 안내 페이지 — 정적 콘텐츠 (DB 없음)
 */

/** 항공권 단독 결제 시 현금영수증·E-ticket 증빙 — FAQ·증빙 블록·고객지원과 동일 문구 */
export const AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY =
  '항공권만 단독으로 결제하는 경우에는 현금영수증 발행이 불가능합니다. 다만 E-ticket에 표시된 금액을 기준으로 증빙자료로 활용하실 수 있습니다.'

export const AIR_TICKETING_HERO = {
  title: '항공권 예매와 발권 안내를 도와드립니다',
  sub: '일반 예매부터 법인카드 결제, 증빙 확인까지 상황에 맞춰 안내해드립니다',
  /** 문장 단위로 나누어 음절 중간 줄바꿈을 줄임 */
  bodyParagraphs: [
    '항공권 예매와 발권은 항공사, 운임 조건, 결제 방식에 따라 필요한 절차가 달라질 수 있습니다.',
    'Bong투어는 항공 예약·발권 시스템을 활용해 항공권 예매를 진행할 수 있으며, 일반 개인 발권부터 법인·기관 관련 확인 사항까지 함께 안내해드립니다.',
  ],
} as const

export type AirUseCaseCard = {
  id: string
  title: string
  description: string
}

export const airTicketingUseCases: AirUseCaseCard[] = [
  {
    id: 'general',
    title: '일반 항공권 예매',
    description: '국내선·국제선 항공권 예매와 기본 발권 절차가 필요한 경우',
  },
  {
    id: 'corporate',
    title: '법인카드 결제',
    description: '법인카드로 항공권 발급이 필요하고, 관련 서류 확인이 필요한 경우',
  },
  {
    id: 'institution',
    title: '기관/공무 일정 발권',
    description: '국외연수, 기관 일정, 공공 목적 일정에 맞춘 발권 및 증빙 확인이 필요한 경우',
  },
  {
    id: 'proof',
    title: '증빙/영수증 확인',
    description: '현금영수증, 결제 증빙, 발급 가능 여부 등을 사전에 확인하고 싶은 경우',
  },
]

export const airTicketingProcessIntro = {
  sectionTitle: '항공권 예매 및 발권은 이렇게 안내해드립니다',
  lead:
    '항공권 예매는 단순 좌석 예약만이 아니라, 운임 조건, 결제 방식, 발권 가능 여부, 제출 서류 확인까지 함께 검토해야 하는 경우가 있습니다. Bong투어는 진행 조건에 맞춰 필요한 절차를 안내해드립니다.',
} as const

export type AirProcessPoint = { id: string; title: string; body: string }

export const airTicketingProcessPoints: AirProcessPoint[] = [
  {
    id: 'p1',
    title: '항공권 예매 가능',
    body: '일반 예매부터 상황별 발권 안내까지 가능합니다.',
  },
  {
    id: 'p2',
    title: '법인카드 결제 가능',
    body: '다만 확인을 위해 추가 서류가 필요할 수 있습니다.',
  },
  {
    id: 'p3',
    title: '조건별 절차 상이',
    body: '항공사, 운임, 발권처에 따라 진행 방식이 달라질 수 있습니다.',
  },
  {
    id: 'p4',
    title: '증빙 기준 확인 가능',
    body: '결제 구조에 따라 현금영수증 및 증빙 안내가 달라질 수 있습니다.',
  },
]

export type AirPaymentBlock = {
  id: string
  title: string
  body: string
}

export const airTicketingPaymentBlocks: AirPaymentBlock[] = [
  {
    id: 'pkg',
    title: '여행상품에 포함된 항공권',
    body:
      '여행상품에 포함된 항공권은 패키지 또는 에어텔 결제 구조 안에서 현금영수증 발행이 가능합니다. 다만 진행 방식과 공급사 기준에 따라 안내 절차가 달라질 수 있으므로, 필요 시 담당자에게 미리 요청해 주세요.',
  },
  {
    id: 'standalone',
    title: '항공권 단독 결제',
    body: AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY,
  },
  {
    id: 'supplier',
    title: '공급사 여행상품 현금영수증',
    body: '공급사의 여행상품에 대한 현금영수증은 해당 공급사에서 발행해드립니다.',
  },
  {
    id: 'corp',
    title: '법인카드 항공권 발급',
    body:
      '법인카드로 항공권 발급이 가능합니다. 다만 발급 과정에서 확인을 위해 명함, 사원증, 재직증명서 등의 서류가 필요할 수 있습니다. 필요 서류는 항공사 또는 발권 조건에 따라 달라질 수 있으므로, 진행 시 안내에 따라 준비해 주세요.',
  },
]

export type AirFaqItem = { id: string; question: string; answer: string }

export const airTicketingFaqItems: AirFaqItem[] = [
  {
    id: 'afaq-1',
    question: '항공권 예매도 직접 가능한가요?',
    answer:
      '네. Bong투어는 항공 예약·발권 시스템을 활용해 항공권 예매를 진행할 수 있습니다. 항공사와 운임 조건에 따라 적용되는 발권 방식이 다를 수 있으며, 필요한 절차는 진행 과정에서 안내드립니다.',
  },
  {
    id: 'afaq-2',
    question: '법인카드로 항공권 발급이 가능한가요?',
    answer:
      '네. 법인카드로 항공권 발급이 가능합니다. 다만 발급 과정에서 확인을 위해 명함, 사원증, 재직증명서 등의 서류가 필요할 수 있습니다. 필요 서류는 항공사 또는 발권 조건에 따라 달라질 수 있으므로, 진행 시 안내에 따라 준비해 주세요.',
  },
  {
    id: 'afaq-3',
    question: '여행상품에 포함된 항공권은 현금영수증 발행이 가능한가요?',
    answer:
      '여행상품에 포함된 항공권은 패키지 또는 에어텔 결제 구조 안에서 현금영수증 발행이 가능합니다. 다만 진행 방식과 공급사 기준에 따라 안내 절차가 달라질 수 있으므로, 필요 시 담당자에게 미리 요청해 주세요.',
  },
  {
    id: 'afaq-4',
    question: '항공권만 단독으로 결제하는 경우에도 현금영수증이 가능한가요?',
    answer: AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY,
  },
  {
    id: 'afaq-5',
    question: '공급사 여행상품 현금영수증은 어떻게 되나요?',
    answer: '공급사의 여행상품에 대한 현금영수증은 해당 공급사에서 발행해드립니다.',
  },
  {
    id: 'afaq-6',
    question: '국외연수 관련 발권도 안내 가능한가요?',
    answer:
      '네. 국외연수는 항공 발권, 증빙, 확인 서류, 예산 집행 흐름까지 함께 검토해야 하는 경우가 많습니다. 진행 상황에 맞춰 필요한 내용을 안내드립니다.',
  },
  {
    id: 'afaq-7',
    question: '진행 전에 어떤 정보를 준비하면 좋나요?',
    answer:
      '출발 구간, 희망 날짜, 탑승 인원, 결제 방식, 발권 목적(개인/법인/기관) 정도가 정리되어 있으면 안내가 더 수월합니다.',
  },
]

export const airTicketingClosing = {
  title: '발권 전 확인이 필요한 내용을 먼저 살펴보실 수 있습니다',
  /** 정보 확인 — 문단 단위로 줄바꿈·keep-all 대응 */
  bodyParagraphs: [
    '항공권 예매와 발권은 항공사, 결제 방식, 증빙 조건에 따라 절차가 달라질 수 있습니다.',
    '법인카드 결제, 현금영수증, 여행상품 포함 항공권 여부 등은 진행 전에 확인하시는 것이 좋습니다.',
  ],
  /** 보조 링크 한 줄 — 링크 라벨만 `고객지원`으로 두고 본문은 분리 */
  supportHintBefore: '더 필요한 안내는 ',
  supportHintAfter: '에서 확인하실 수 있습니다.',
} as const
