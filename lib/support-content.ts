/**
 * 고객지원 페이지 정적 콘텐츠 (DB·관리자 CRUD 없음)
 */

import { AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY } from '@/lib/air-ticketing-content'

export const SUPPORT_HERO = {
  title: '필요한 안내를 빠르게 확인하실 수 있습니다',
  /** 문장 나눔으로 줄바꿈 정리 */
  bodyLines: [
    '진행 절차, 답변 채널, 전화 상담, 증빙 안내, 회원 관련 내용까지',
    '고객지원에서 확인하실 수 있습니다.',
  ],
} as const

export type SupportCategoryItem = {
  id: string
  title: string
  description: string
  anchor: string
}

/** 빠른 도움 카테고리 — anchor는 페이지 내 섹션 id */
export const supportCategories: SupportCategoryItem[] = [
  {
    id: 'cat-process',
    title: '진행 안내',
    description: '문의 후 어떤 순서로 확인과 상담이 진행되는지 안내드립니다.',
    anchor: 'support-process',
  },
  {
    id: 'cat-channels',
    title: '답변 채널',
    description: '이메일, 카카오톡, 전화 안내가 어떻게 이어지는지 확인하실 수 있습니다.',
    anchor: 'support-contact',
  },
  {
    id: 'cat-receipt',
    title: '증빙/영수증 안내',
    description: '현금영수증, 공급사 상품 관련 영수증, 국외연수 영수증 안내를 확인하실 수 있습니다.',
    anchor: 'support-receipt',
  },
  {
    id: 'cat-change',
    title: '변경/취소 안내',
    description:
      '일정 변경이나 취소 가능 여부는 서비스별로 다를 수 있으며, 기본 안내를 먼저 확인하실 수 있습니다.',
    anchor: 'support-faq',
  },
  {
    id: 'cat-account',
    title: '회원/로그인 안내',
    description: '회원가입, 로그인, 기본 계정 관련 내용을 확인하실 수 있습니다.',
    anchor: 'support-faq',
  },
  {
    id: 'cat-faq',
    title: '자주 묻는 질문',
    description: '문의 전후 가장 많이 확인하시는 내용을 모아두었습니다.',
    anchor: 'support-faq',
  },
]

export type SupportFaqItem = {
  id: string
  question: string
  answer: string
}

export const supportFaqItems: SupportFaqItem[] = [
  {
    id: 'faq-1',
    question: '문의를 남기면 언제 답변을 받을 수 있나요?',
    answer:
      '가능한 한 순차적으로 확인 후 안내드리고 있습니다. 접수량이나 문의 내용에 따라 답변 시점은 달라질 수 있으며, 필요한 경우 추가 확인 후 안내드립니다.',
  },
  {
    id: 'faq-2',
    question: '이메일과 카카오톡 중 어떤 방식으로 답변받을 수 있나요?',
    answer:
      '문의하실 때 답변받을 방법을 선택하실 수 있습니다. 이메일, 카카오톡, 또는 둘 다 가능으로 선택할 수 있으며, 선택하신 방식 기준으로 안내드립니다.',
  },
  {
    id: 'faq-3',
    question: '카카오톡으로 문의하면 어떻게 진행되나요?',
    answer:
      '카카오톡 문의가 확인되면 보다 정확한 상담을 위해 전화 안내가 함께 진행될 수 있습니다.',
  },
  {
    id: 'faq-4',
    question: '전화를 받지 못하면 어떻게 되나요?',
    answer:
      '전화를 받지 못하신 경우에는 상황에 따라 다시 연락드리거나, 남겨주신 답변 채널 기준으로 후속 안내를 이어드립니다.',
  },
  {
    id: 'faq-5',
    question: '전화 상담도 가능한가요?',
    answer: '네. 필요한 경우 전화로도 상담을 진행합니다. 대표번호는 031-213-2558 입니다.',
  },
  {
    id: 'faq-6',
    question: '항공권 예매·발권·증빙은 어디서 확인하나요?',
    answer:
      '항공권 예매, 발권, 현금영수증·법인카드 등 증빙은 상단 메뉴「항공권 예매 및 발권」페이지에서 구분해 안내드립니다.',
  },
  {
    id: 'faq-6-air-standalone',
    question: '항공권만 단독으로 결제하는 경우에도 현금영수증이 가능한가요?',
    answer: AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY,
  },
  {
    id: 'faq-7',
    question: '국외연수 영수증은 어떻게 안내받나요?',
    answer: '국외연수 영수증 관련 내용은 진행 상황과 요청 범위에 따라 담당자가 별도로 안내드립니다.',
  },
  {
    id: 'faq-8',
    question: '세금계산서나 증빙 서류 발급이 가능한가요?',
    answer:
      '필요한 증빙 종류에 따라 안내가 가능합니다. 세금계산서, 영수증, 제출용 확인 자료 등은 진행 내용과 서비스 유형에 따라 가능 범위를 확인해드립니다.',
  },
  {
    id: 'faq-9',
    question: '변경이나 취소는 언제까지 가능한가요?',
    answer:
      '변경 및 취소 가능 여부는 서비스 유형과 진행 단계에 따라 달라질 수 있습니다. 확정 전 단계와 확정 후 단계의 기준이 다를 수 있으므로, 현재 진행 상태를 기준으로 안내받으시는 것이 가장 정확합니다.',
  },
  {
    id: 'faq-10',
    question: '카드 할부나 부분결제도 가능한가요?',
    answer:
      '결제 방식은 상품과 진행 구조에 따라 달라질 수 있습니다. 필요한 경우 담당자와 먼저 확인해 주세요.',
  },
  {
    id: 'faq-11',
    question: '외국인도 예약이 가능한가요?',
    answer:
      '예약 유형에 따라 가능 여부가 달라질 수 있으며, 정확한 영문명과 여권정보 확인이 필요할 수 있습니다.',
  },
  {
    id: 'faq-12',
    question: '최소출발 인원이 부족하면 어떻게 되나요?',
    answer:
      '단체형 상품은 최소출발 인원 충족 여부에 따라 일정이 확정되거나 조정될 수 있습니다.',
  },
  {
    id: 'faq-13',
    question: '국외연수는 조건이 모두 정해지지 않아도 상담 가능한가요?',
    answer:
      '네. 연수 목적, 희망 국가 또는 도시, 예상 인원처럼 현재 정해진 범위의 정보만 있어도 상담을 시작하실 수 있습니다. 세부 일정과 기관 구성은 이후 상담 과정에서 함께 정리할 수 있습니다.',
  },
  {
    id: 'faq-14',
    question: '전세버스는 인원이나 시간이 아직 확정되지 않아도 문의할 수 있나요?',
    answer:
      '네. 출발지, 도착지, 이용 날짜 정도만 있어도 상담 방향을 먼저 확인하실 수 있습니다. 인원, 대기 여부, 왕복 조건 등은 상담 과정에서 함께 정리해드립니다.',
  },
  {
    id: 'faq-15',
    question: '회원가입 없이도 문의할 수 있나요?',
    answer:
      '현재 문의 유형에 따라 비회원 문의가 가능한 구조를 우선 검토하고 있으며, 필요한 경우 최소한의 정보만으로도 접수가 가능하도록 구성하고 있습니다.',
  },
  {
    id: 'faq-16',
    question: '문의 내용을 수정해서 다시 전달할 수 있나요?',
    answer:
      '네. 접수 후 상담 과정에서 일정, 인원, 조건이 바뀌는 경우 다시 확인하여 조정할 수 있습니다. 변경된 내용을 기준으로 가능한 방향을 다시 안내드립니다.',
  },
]

export type SupportProcessStep = {
  step: number
  title: string
  description: string
}

export const supportProcessSteps: SupportProcessStep[] = [
  { step: 1, title: '문의 접수', description: '남겨주신 기본 정보를 먼저 확인합니다.' },
  { step: 2, title: '내용 확인', description: '서비스 유형과 요청 내용을 기준으로 검토를 진행합니다.' },
  {
    step: 3,
    title: '필요 시 추가 확인',
    description: '일정, 인원, 조건 등 추가 확인이 필요한 경우 다시 안내드립니다.',
  },
  { step: 4, title: '상담 진행', description: '확인된 내용을 바탕으로 가능한 방향과 조건을 설명드립니다.' },
  { step: 5, title: '후속 안내', description: '진행 가능한 범위와 다음 절차를 정리해 안내드립니다.' },
]

export const supportProcessNote =
  '카카오톡 문의가 확인된 경우에는 보다 정확한 안내를 위해 전화 상담이 함께 진행될 수 있습니다.'

export const SUPPORT_PHONE_DISPLAY = '031-213-2558' as const
export const SUPPORT_PHONE_TEL = 'tel:0312132558' as const

export const supportContactCopy = {
  sectionTitle: '답변 채널 안내',
  lead:
    '문의하실 때 이메일 또는 카카오톡 답변 방식을 선택하실 수 있습니다. 진행 내용에 따라 선택하신 채널을 기준으로 순차적으로 안내드립니다.',
  phoneLine: '필요한 경우 전화로도 상담을 진행합니다. 대표번호는 031-213-2558 입니다.',
  kakaoLine:
    '카카오톡 문의가 확인되면, 보다 정확한 상담을 위해 전화 안내를 먼저 드릴 수 있습니다.',
  missedCallLine: '전화를 받지 못하신 경우에는 남겨주신 답변 채널 기준으로 후속 안내를 이어드립니다.',
} as const

export const supportOpenKakaoNotice = {
  title: '오픈카톡 상담 안내',
  greeting: '안녕하세요. 봉투어 상담 채널입니다.',
  hours: '상담 가능 시간은 08:00~19:00입니다. 운영시간 외 문의는 남겨주시면 다음 상담 시간에 순차적으로 답변드립니다.',
  quickGuide:
    '빠른 상담을 위해 출발 희망일, 인원(성인/아동/유아), 전화번호(권장), 문의 내용을 함께 남겨 주세요.',
  emergency: '급한 문의는 대표번호로 전화 주세요. 자료 첨부가 필요한 경우에는 이메일 문의를 이용해 주세요.',
  caution: '채팅만으로 예약이 자동 확정되지는 않으며, 가능 여부와 요금은 확인 후 안내드립니다.',
} as const

export type SupportReceiptBlock = {
  id: string
  title: string
  body: string
}

/** 증빙·영수증 — 항공 상세는 항공권 예매 및 발권 페이지로 분리 */
export const supportReceiptInfo: SupportReceiptBlock[] = [
  {
    id: 'receipt-air-hub',
    title: '항공권 예매·발권·증빙',
    body:
      '여행상품 포함 항공권, 단독 결제, 법인카드 발급, 현금영수증 여부 등은「항공권 예매 및 발권」페이지에서 구분해 안내드립니다. ' +
      AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY,
  },
  {
    id: 'receipt-supplier',
    title: '공급사 여행상품',
    body: '공급사의 여행상품에 대한 현금영수증은 해당 공급사에서 발행해드립니다.',
  },
  {
    id: 'receipt-training',
    title: '국외연수 영수증',
    body: '국외연수 영수증 관련 내용은 진행 상황과 요청 범위에 따라 담당자가 별도로 안내드립니다.',
  },
]

/** 증빙 요약 — 항공 세부는 /air-ticketing 참고 */
export const supportReceiptSummaryLines: string[] = [
  '항공권·현금영수증·법인카드 발급 등은「항공권 예매 및 발권」페이지에서 먼저 확인해 주세요.',
  AIR_TICKET_STANDALONE_CASH_RECEIPT_COPY,
  '공급사 여행상품의 현금영수증은 해당 공급사에서 발행합니다.',
  '국외연수 영수증은 담당자가 별도로 안내드립니다.',
]
