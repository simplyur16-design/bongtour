/**
 * 관리자 답변 초안용 FAQ. 고객 공개 페이지는 바꾸지 않는다.
 * 상품 문의·견적 문장은 저장소 화면·약관만, eSIM 문장은 저장소 정책·설치 안내만 사용한다.
 * 공식 FAQ 페이지(https://www.usimsa.com/board/faq)는 2026-11-16에 열렸으나 본문이 비어 문장을 가져오지 못했다.
 * 고객에게 보이는 question·answer에는 공급사 이름을 넣지 않는다.
 */
import { airTicketingPaymentBlocks } from '@/lib/air-ticketing-content'
import {
  ANDROID_STEPS,
  COMMON_FAQ,
  IOS_STEPS,
  PRECHECK_BLOCKS,
  PRECHECK_FAQ,
  type GuideBlock,
  type GuideStep,
} from '@/lib/bongsim/esim-guide-content'
import {
  supportFaqItems,
  supportOpenKakaoNotice,
  supportProcessSteps,
  supportReceiptInfo,
} from '@/lib/support-content'

export type TalktalkFaqCategory = 'inquiry' | 'esim'

export type TalktalkFaqTopic =
  | 'cancel'
  | 'refund'
  | 'passport'
  | 'visa'
  | 'booking'
  | 'payment'
  | 'process'
  | 'esim'

export type TalktalkDraftFaqItem = {
  id: string
  category: TalktalkFaqCategory
  question: string
  answer: string
  /** 고객 초안에 붙이지 않는 파일 경로 */
  source: string
  /** 내부 메타. 고객 답변 문장에 넣지 않는다. */
  sourceUrl: string | null
  sourceNote: string | null
  topics: readonly TalktalkFaqTopic[]
}

const ESIM_FAQ_URL = 'https://www.usimsa.com/board/faq'

const ESIM_SOURCE_NOTE =
  '공식 FAQ 페이지는 열렸으나 본문 문장을 확인하지 못했다. 답은 저장소에 공개된 정책·설치 안내만 사용한다.'

function supportAnswer(id: string): string {
  const item = supportFaqItems.find((f) => f.id === id)
  if (!item) throw new Error(`support FAQ missing: ${id}`)
  return item.answer
}

function airPayment(id: string): string {
  const block = airTicketingPaymentBlocks.find((b) => b.id === id)
  if (!block) throw new Error(`air payment block missing: ${id}`)
  return block.body
}

function receipt(id: string): string {
  const block = supportReceiptInfo.find((b) => b.id === id)
  if (!block) throw new Error(`receipt block missing: ${id}`)
  return block.body
}

function blockLines(block: GuideBlock): string {
  return [...(block.paras ?? []), ...(block.bullets ?? []), block.note ?? ''].filter(Boolean).join(' ')
}

function precheck(heading: string): string {
  const block = PRECHECK_BLOCKS.find((b) => b.heading === heading)
  if (!block) throw new Error(`precheck missing: ${heading}`)
  return blockLines(block)
}

function stepText(steps: readonly GuideStep[], n: number): string {
  const step = steps.find((s) => s.n === n)
  if (!step) throw new Error(`step missing: ${n}`)
  const body = step.blocks
    .map((block) => [block.heading, blockLines(block)].filter(Boolean).join(' '))
    .join(' ')
  return `${step.title}. ${body}`
}

function guideFaq(q: string, pool: readonly { q: string; a: string }[]): string {
  const item = pool.find((f) => f.q === q)
  if (!item) throw new Error(`guide FAQ missing: ${q}`)
  return item.a
}

function inquiry(
  id: string,
  question: string,
  answer: string,
  source: string,
  topics: readonly TalktalkFaqTopic[],
): TalktalkDraftFaqItem {
  return { id, category: 'inquiry', question, answer, source, sourceUrl: null, sourceNote: null, topics }
}

function esim(
  id: string,
  question: string,
  answer: string,
  source: string,
  topics: readonly TalktalkFaqTopic[] = ['esim'],
): TalktalkDraftFaqItem {
  return {
    id,
    category: 'esim',
    question,
    answer,
    source,
    sourceUrl: ESIM_FAQ_URL,
    sourceNote: ESIM_SOURCE_NOTE,
    topics,
  }
}

export const ADMIN_DRAFT_FAQ: readonly TalktalkDraftFaqItem[] = [
  inquiry(
    'inquiry-where',
    '상품 문의는 어디서 하나요?',
    '여행 상담은 문의 접수(/inquiry?type=travel)에서 합니다. 문의 유형을 선택하면 필요한 정보와 담당 흐름이 달라질 수 있습니다.',
    'lib/inquiry-page.ts',
    ['booking', 'process'],
  ),
  inquiry(
    'inquiry-types',
    '문의 유형은 무엇이 있나요?',
    '여행 상담, 기관 섭외, 국외 연수, 버스 견적 네 가지입니다. 기관 섭외는 일반 패키지 상담과 다를 수 있고, 국외연수는 필수 항목만으로 접수한 뒤 상담으로 조건을 정리합니다. 전세버스는 예상 인원만으로 접수할 수 있으며 왕복 기준이고, 노선·일정·차량은 상담에서 맞춥니다.',
    'lib/inquiry-page.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-fields',
    '여행 상담에 어떤 정보를 적나요?',
    '신청자 이름, 연락처, 문의 내용을 적습니다. 희망 출발 월, 성인(만 12세 이상)·아동(만 2세 이상~만 12세 미만)·유아(만 2세 미만), 희망 지역·국가는 추가로 남길 수 있습니다. 인원 기준은 일반적인 여행 기준이며 실제 적용은 상품·항공 규정에 따라 달라질 수 있습니다. 빠른 상담을 위해 출발 희망일, 인원(성인/아동/유아), 문의 내용을 함께 남기면 됩니다.',
    'lib/inquiry-form-i18n.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-custom-quote',
    '맞춤 견적에는 무엇을 꼭 적나요?',
    '맞춤 견적은 희망 여행지 또는 국가/도시, 출발 희망일 또는 출발 희망월 중 하나, 1명 이상의 인원, 그리고 문의 내용이 필요합니다. 문의 내용은 10자 이상입니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-training-quote',
    '국외연수 견적은 어떻게 접수하나요?',
    '국외연수는 필요한 서비스를 고릅니다. 견적 모드이면 희망 국가 또는 도시, 출발 희망일 또는 출발 희망월, 1명 이상의 예상 인원, 이메일이 필요합니다. 필수 항목만으로도 접수는 가능하고, 접수만으로 예약·확정이 되지는 않습니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-group-bus',
    '단체·전세버스 견적은 어떻게 하나요?',
    '전세·단체 버스는 1명 이상의 예상 인원과 이메일이 필요합니다. 예상 인원만으로도 접수할 수 있고, 왕복 기준이며 노선·일정·차량은 상담하면서 맞춥니다. 접수만으로 배차가 확정되지는 않습니다.',
    'lib/inquiry-page.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-not-confirmed',
    '문의를 내면 예약이 확정되나요?',
    '제출한 내용은 접수·상담용이며, 확정 안내 전까지 계약·예약 확정으로 보지 않습니다. 회사는 상담 신청 또는 예약 요청이 접수되었다는 사정만으로 예약 또는 계약이 확정된 것으로 보지 않습니다. 상담연결형 서비스는 외부 공급사 또는 실제 계약 당사자의 승낙 및 예약 확정 시에 계약이 성립합니다.',
    'app/terms/page.tsx',
    ['booking'],
  ),
  inquiry(
    'inquiry-when',
    '문의 답변은 언제 오나요?',
    `${supportAnswer('faq-1')} ${supportOpenKakaoNotice.hours}`,
    'lib/support-content.ts',
    ['process'],
  ),
  inquiry(
    'inquiry-channel',
    '답변은 어떤 채널로 받나요?',
    supportAnswer('faq-2'),
    'lib/support-content.ts',
    ['process'],
  ),
  inquiry(
    'inquiry-steps',
    '견적·상담은 어떤 순서로 진행되나요?',
    supportProcessSteps.map((s) => `${s.step}. ${s.title}: ${s.description}`).join(' '),
    'lib/support-content.ts',
    ['process', 'booking'],
  ),
  inquiry(
    'inquiry-listed-price',
    '사이트에 나온 가격이 확정 요금인가요?',
    '사이트에 게시된 가격은 참고용이거나 상담 기준 가격일 수 있으며, 실제 확정 가격은 상담 과정 또는 별도 견적서, 예약 확정 안내에 따라 달라질 수 있습니다. 사이트에 게시된 정보는 작성 시점 기준이며, 예약 가능 여부, 가격, 좌석 또는 객실, 출발 가능 여부, 행사 조건에 따라 달라질 수 있습니다.',
    'app/terms/page.tsx',
    ['payment'],
  ),
  inquiry(
    'inquiry-who-pays',
    '결제는 어디서 하나요?',
    '회사는 서비스 유형에 따라 직접 결제를 받거나, 결제 없이 상담만 연결할 수 있습니다. 상담연결형 서비스에서 실제 결제는 외부 공급사 또는 실제 계약 당사자를 통해 진행될 수 있습니다. 직접 결제를 받는 경우 결제 조건과 세부 금액은 별도 고지합니다.',
    'app/terms/page.tsx',
    ['payment'],
  ),
  inquiry(
    'inquiry-installment',
    '카드 할부나 부분결제도 가능한가요?',
    supportAnswer('faq-10'),
    'lib/support-content.ts',
    ['payment'],
  ),
  inquiry(
    'inquiry-receipt',
    '여행상품 현금영수증은 누가 발행하나요?',
    `${receipt('receipt-supplier')} ${airPayment('pkg')}`,
    'lib/support-content.ts',
    ['payment'],
  ),
  inquiry(
    'inquiry-cancel',
    '예약 후 변경·취소·환불은 어떻게 되나요?',
    `${supportAnswer('faq-9')} 실제 예약 또는 계약이 성립한 이후의 취소, 환불, 변경은 회사가 직접 당사자인 서비스는 회사가 별도로 고지한 조건, 외부 공급사와 계약이 성립한 서비스는 해당 공급사·실제 계약 당사자·개별 약관·특별약관 또는 별도 안내, 법령 또는 표준약관이 우선이면 그 법령 또는 표준약관에 따릅니다.`,
    'app/terms/page.tsx',
    ['cancel', 'refund'],
  ),
  inquiry(
    'inquiry-standard-terms',
    '여행 표준약관이 적용되나요?',
    '국외여행 또는 국내여행 계약이 실제로 성립하는 경우, 공정거래위원회의 국내·국외여행 표준약관이 참조 또는 준용될 수 있으며, 상품 특성상 별도 특별약관이 적용될 수 있습니다. 특별약관은 법령 및 표준약관 취지에 반하지 않아야 합니다.',
    'app/terms/page.tsx',
    ['cancel', 'refund'],
  ),
  inquiry(
    'inquiry-chat',
    '채팅만으로 예약이 확정되나요?',
    supportOpenKakaoNotice.caution,
    'lib/support-content.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-min-pax',
    '최소출발 인원이 부족하면 어떻게 되나요?',
    supportAnswer('faq-12'),
    'lib/support-content.ts',
    ['booking'],
  ),
  inquiry(
    'inquiry-passport-name',
    '외국인 예약에 여권 정보가 필요한가요?',
    supportAnswer('faq-11'),
    'lib/support-content.ts',
    ['passport', 'booking'],
  ),
  inquiry(
    'inquiry-organizer',
    '행사와 판매는 누가 하나요?',
    '본 상품은 [브랜드명]의 상품으로, 실제 행사는 해당 여행사와 현지 랜드사에서 진행합니다. 판매 대행은 Bong투어입니다.',
    'app/components/detail/OrganizerNotice.tsx',
    ['booking'],
  ),
  esim(
    'esim-qr-sent',
    'eSIM을 사면 QR은 언제 오나요?',
    'eSIM은 결제 완료 후 이메일로 QR코드가 즉시 발송됩니다. 카카오 알림톡과 마이페이지에서도 같은 QR 또는 바로 설치 링크를 확인할 수 있습니다.',
    'app/travel/esim/policy/page.tsx',
  ),
  esim(
    'esim-iphone',
    '아이폰에는 어떻게 설치하나요?',
    `${stepText(IOS_STEPS, 1)} ${stepText(IOS_STEPS, 2)}`,
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-android',
    '안드로이드·갤럭시에는 어떻게 설치하나요?',
    `${stepText(ANDROID_STEPS, 1)} ${stepText(ANDROID_STEPS, 2)}`,
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-when',
    'eSIM은 언제 설치하나요?',
    precheck('1. 언제 설치하나요?'),
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-device-check',
    '내 휴대폰이 eSIM을 지원하는지 어떻게 보나요?',
    '아이폰은 설정 → 셀룰러(또는 모바일 데이터)에 eSIM 추가 메뉴가 보이면 지원 기기입니다. 갤럭시·Pixel은 설정 → 연결 → SIM 관리자 또는 SIM 카드 및 모바일 네트워크에 eSIM 추가 메뉴가 있으면 지원 기기입니다. 기종 목록은 이용 가능 기기 화면에 있습니다.',
    'app/travel/esim/help/device-compatibility/page.tsx',
  ),
  esim(
    'esim-lock',
    '통신사 잠금이 있으면 eSIM을 쓸 수 있나요?',
    '통신사 약정으로 구매해 아직 잠금이 풀리지 않은 단말, 중국 본토 내수용 아이폰, eSIM 메뉴가 없는 단말은 구매 전에 한 번 더 확인해야 합니다. 확실하지 않으면 고객센터에 먼저 문의합니다.',
    'app/travel/esim/help/device-compatibility/page.tsx',
  ),
  esim(
    'esim-activate',
    '사용 기간은 언제부터인가요?',
    '데이터 사용 기간은 구매한 플랜에 따라 다르며, 최초 활성화(현지 네트워크 연결) 시점부터 기산됩니다. 최대 서비스 제공기간은 결제일로부터 180일(미활성화 기준)입니다.',
    'app/travel/esim/policy/page.tsx',
  ),
  esim(
    'esim-roaming',
    '현지에서 로밍과 APN은 어떻게 하나요?',
    `${precheck('2. 요금 폭탄 막는 법 (가장 중요)')} ${guideFaq('데이터 로밍을 켜야 하나요?', COMMON_FAQ)}`,
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-offline',
    '현지에서 연결이 안 되거나 느리면 어떻게 하나요?',
    `${guideFaq('해외에서 갑자기 안 돼요.', COMMON_FAQ)} ${precheck('2. 요금 폭탄 막는 법 (가장 중요)')}`,
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-reinstall',
    'eSIM을 지우거나 다시 설치해도 되나요?',
    `eSIM QR코드는 1회만 사용 가능하며, 삭제 시 재설치가 불가합니다. ${precheck('3. QR·설치코드는 1회성이에요')} ${stepText(IOS_STEPS, 4)}`,
    'app/travel/esim/policy/page.tsx',
  ),
  esim(
    'esim-move',
    '다른 휴대폰으로 옮길 수 있나요?',
    guideFaq('eSIM을 다른 휴대폰으로 옮길 수 있나요?', PRECHECK_FAQ),
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-dual',
    '유심과 eSIM을 같이 쓰면 데이터는 어디로 가나요?',
    guideFaq('듀얼심(유심+eSIM)인데 데이터만 eSIM으로 쓰려면?', PRECHECK_FAQ),
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-qr-missing',
    'QR이 안 보이면 어디서 보나요?',
    guideFaq('QR이 안 보여요 / 문자를 못 받았어요.', COMMON_FAQ),
    'lib/bongsim/esim-guide-content.ts',
  ),
  esim(
    'esim-refund',
    'eSIM 환불은 언제 되나요?',
    'QR코드 미사용(미활성화) 시 전액 환불 가능합니다. QR코드 사용(활성화) 후에는 환불되지 않습니다. 제품 결함 시에는 전액 환불 또는 재발급입니다. 환불·이용 문의는 고객센터에서 24시간 접수합니다.',
    'app/travel/esim/policy/page.tsx',
    ['esim', 'refund'],
  ),
  esim(
    'esim-exchange',
    'eSIM은 교환되나요?',
    'eSIM은 교환이 불가합니다. 제품 결함 시 동일 상품 재발급으로 대체합니다.',
    'app/travel/esim/policy/page.tsx',
  ),
  esim(
    'esim-early-install',
    '미리 설치하면 안 되는 상품을 설치했어요.',
    guideFaq('사전 설치가 안 되는 상품을 실수로 미리 설치했어요.', PRECHECK_FAQ),
    'lib/bongsim/esim-guide-content.ts',
  ),
]

/** 저장소·확인한 공식 페이지 본문에 답이 없는 질문 */
export const TALKTALK_FAQ_NEEDS_ANSWER: readonly { question: string; why: string }[] = [
  {
    question: '견적서는 몇 시간 안에 나오나요?',
    why: '답변 시점이 달라질 수 있다는 안내만 있고, 견적 소요 시간 숫자는 없습니다.',
  },
  {
    question: '여권 잔여 유효기간은 얼마나 있어야 하나요?',
    why: '고객 약관·고객지원 문구에 잔여 기간 숫자가 없습니다.',
  },
  {
    question: '이 국가는 무비자인가요, 비자가 필요한가요?',
    why: '목적지별 비자 규정이 공통 안내로 없습니다.',
  },
  {
    question: '출발 며칠 전 취소 수수료는 몇 %인가요?',
    why: '일수·비율표는 저장소 약관에 없고, 브랜드 취소 수수료는 DB 약관 필드에만 있습니다.',
  },
  {
    question: '예약금·계약금은 얼마인가요?',
    why: '금액이 적힌 공통 예약금 안내가 없습니다.',
  },
  {
    question: '아동·유아 요금은 성인 요금의 몇 %인가요?',
    why: '공통 산식이 없습니다. 출발 행에 저장된 금액만 쓸 수 있습니다.',
  },
  {
    question: 'eSIM APN에 어떤 주소를 입력하나요?',
    why: '설치 안내에 APN 주소 값이 없고, 공식 FAQ 본문도 확인하지 못했습니다.',
  },
  {
    question: '데이터가 떨어지면 고객이 어떻게 충전하나요?',
    why: '연장은 연동 문서의 파트너 요청으로만 있고, 고객 화면 절차와 금액은 없습니다.',
  },
  {
    question: '어느 정도 속도가 정상인가요?',
    why: '느리다면 고객센터로 문의하라는 문장만 있고, 속도 숫자는 없습니다.',
  },
]

export function faqCountByCategory(): Record<TalktalkFaqCategory, number> {
  return {
    inquiry: ADMIN_DRAFT_FAQ.filter((item) => item.category === 'inquiry').length,
    esim: ADMIN_DRAFT_FAQ.filter((item) => item.category === 'esim').length,
  }
}

export function customerFaqBlob(items: readonly TalktalkDraftFaqItem[] = ADMIN_DRAFT_FAQ): string {
  return items.map((item) => `${item.question}\n${item.answer}`).join('\n')
}

export function selectDraftFaq(inquiryText: string, limit = 4): TalktalkDraftFaqItem[] {
  const text = String(inquiryText ?? '')
  const topics = new Set<TalktalkFaqTopic>()
  if (/취소|환불|변경/.test(text)) {
    topics.add('cancel')
    topics.add('refund')
  }
  if (/결제|카드|할부|영수증|현금/.test(text)) topics.add('payment')
  if (/예약|확정|접수|견적|단체|맞춤/.test(text)) topics.add('booking')
  if (/여권|영문/.test(text)) topics.add('passport')
  if (/진행|순서|상담/.test(text)) topics.add('process')
  if (/e\s*sim|이심|qr|설치|로밍|apn|갤럭시|아이폰/i.test(text)) topics.add('esim')
  if (topics.size === 0) topics.add('booking')
  return ADMIN_DRAFT_FAQ.filter((item) => item.topics.some((topic) => topics.has(topic))).slice(0, limit)
}
