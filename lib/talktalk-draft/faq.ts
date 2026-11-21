/**
 * 관리자 답변 초안용 FAQ. 고객 공개 페이지는 바꾸지 않는다.
 * 상품 문의·견적 문장은 저장소 화면·약관만, eSIM 문장은 저장소 정책·설치 안내만 사용한다.
 * 공식 FAQ BDT002는 2026-11-16 조회분 요지를 내부 메타로만 둔다. 다시 호출하지 않는다.
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
import { inferTalktalkFaqCategory } from '@/lib/talktalk-draft/parse-inquiry'
import {
  supportFaqItems,
  supportOpenKakaoNotice,
  supportProcessSteps,
  supportReceiptInfo,
} from '@/lib/support-content'

export type TalktalkFaqCategory =
  | 'package'
  | 'fit'
  | 'air'
  | 'hotel'
  | 'training'
  | 'institution'
  | 'private'
  | 'bus'
  | 'common'
  | 'esim'

export const TALKTALK_FAQ_CATEGORIES: readonly { id: TalktalkFaqCategory; label: string }[] = [
  { id: 'package', label: '패키지' },
  { id: 'fit', label: '자유여행' },
  { id: 'air', label: '항공만' },
  { id: 'hotel', label: '호텔만' },
  { id: 'training', label: '국외연수' },
  { id: 'institution', label: '연수기관 섭외' },
  { id: 'private', label: '우리끼리' },
  { id: 'bus', label: '전세버스' },
  { id: 'common', label: '공통 접수·약관' },
  { id: 'esim', label: 'eSIM' },
]

export type TalktalkFaqTopic =
  | 'cancel'
  | 'refund'
  | 'passport'
  | 'visa'
  | 'booking'
  | 'payment'
  | 'process'
  | 'esim'
  | 'seat'
  | 'departure'
  | 'included'
  | 'shopping'
  | 'extra-fee'
  | 'agent'

/** 좁은 주제. 문의에 이 주제가 맞으면 넓은 주제(예약·결제 등)보다 먼저 고른다. */
export const TALKTALK_SPECIFIC_FAQ_TOPICS: ReadonlySet<TalktalkFaqTopic> = new Set<TalktalkFaqTopic>([
  'seat',
  'departure',
  'included',
  'shopping',
  'extra-fee',
  'agent',
  'passport',
  'visa',
])

/** REGRESSION-FREEZE[talktalk-faq-specific-topics-1122]: 잔여석·출발확정·포함·유류·팁·쇼핑·1인실·아동·상담원 문의 주제. */
export function talktalkSpecificTopicsForText(text: string): TalktalkFaqTopic[] {
  const out: TalktalkFaqTopic[] = []
  if (/잔여\s*석|남은\s*(자리|좌석)|자리\s*(있|남)|좌석\s*(있|남)|마감/.test(text)) out.push('seat')
  if (/출발\s*확정|출확|확정\s*출발|최소\s*(출발|인원)|인원.{0,6}부족/.test(text)) out.push('departure')
  if (/불포함|포함|유류|할증|가이드\s*(경비|비|팁)|팁/.test(text)) out.push('included')
  if (/쇼핑|선택\s*관광|현지\s*옵션|옵션/.test(text)) out.push('shopping')
  if (/1인실|싱글|독실|아동|유아|어린이|아이\s*(요금|나이)/.test(text)) out.push('extra-fee')
  if (/상담원|상담사|사람이랑|직원\s*연결|전화\s*상담/.test(text)) out.push('agent')
  return out
}

/** 좁은 주제가 맞은 항목을 앞으로, 맞은 주제 수가 많은 항목을 앞으로. 같은 점수는 원래 순서 유지. */
function koBigrams(text: string): Set<string> {
  const compact = String(text ?? '').replace(/[^0-9A-Za-z가-힣]/g, '')
  const out = new Set<string>()
  for (let i = 0; i + 1 < compact.length; i++) out.add(compact.slice(i, i + 2))
  return out
}

export function rankFaqByTopics(
  items: readonly TalktalkDraftFaqItem[],
  topics: ReadonlySet<TalktalkFaqTopic>,
  inquiryText = '',
): TalktalkDraftFaqItem[] {
  const asked = koBigrams(inquiryText)
  const overlap = (item: TalktalkDraftFaqItem) => {
    if (asked.size === 0) return 0
    let n = 0
    for (const g of koBigrams(item.question)) if (asked.has(g)) n += 1
    return n
  }
  const score = (item: TalktalkDraftFaqItem) => {
    let specific = 0
    let any = 0
    for (const t of item.topics) {
      if (!topics.has(t)) continue
      any += 1
      if (TALKTALK_SPECIFIC_FAQ_TOPICS.has(t)) specific += 1
    }
    return specific * 1000 + overlap(item) * 10 + any
  }
  return items
    .map((item, index) => ({ item, index, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.item)
}

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
  /** 항목을 복제하지 않고 다른 종류 탭에도 보여 준다. */
  also?: readonly TalktalkFaqCategory[]
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
  category: TalktalkFaqCategory = 'common',
  also?: readonly TalktalkFaqCategory[],
): TalktalkDraftFaqItem {
  return { id, category, question, answer, source, sourceUrl: null, sourceNote: null, topics, also }
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

const BDT002_URL = 'https://apps-usimsa-prod-webapi-01.azurewebsites.net/esim/v1/boards/BDT002'

function officialEsim(
  id: string,
  question: string,
  answer: string,
  topics: readonly TalktalkFaqTopic[] = ['esim'],
): TalktalkDraftFaqItem {
  return {
    id,
    category: 'esim',
    question,
    answer,
    source: 'docs/talktalk-faq-inventory-1116.md',
    sourceUrl: BDT002_URL,
    sourceNote: '공식 FAQ BDT002, 조회 2026-11-16',
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
    'common',
    ['package', 'fit', 'air', 'hotel', 'private'],
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
    'common',
    ['package', 'fit', 'hotel', 'private'],
  ),
  inquiry(
    'inquiry-custom-quote',
    '맞춤 견적에는 무엇을 꼭 적나요?',
    '맞춤 견적은 희망 여행지 또는 국가/도시, 출발 희망일 또는 출발 희망월 중 하나, 1명 이상의 인원, 그리고 문의 내용이 필요합니다. 문의 내용은 10자 이상입니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
    'private',
  ),
  inquiry(
    'inquiry-training-quote',
    '국외연수 견적은 어떻게 접수하나요?',
    '국외연수는 필요한 서비스를 고릅니다. 견적 모드이면 희망 국가 또는 도시, 출발 희망일 또는 출발 희망월, 1명 이상의 예상 인원, 이메일이 필요합니다. 필수 항목만으로도 접수는 가능하고, 접수만으로 예약·확정이 되지는 않습니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
    'training',
  ),
  inquiry(
    'inquiry-group-bus',
    '단체·전세버스 견적은 어떻게 하나요?',
    '예상 인원만으로도 접수할 수 있습니다. 전세버스는 왕복 기준이며, 노선·일정·차량은 상담하면서 맞춰 드립니다. 접수만으로 배차가 확정되지는 않습니다.',
    'lib/inquiry-page.ts',
    ['booking'],
    'bus',
  ),
  inquiry(
    'inquiry-not-confirmed',
    '문의를 내면 예약이 확정되나요?',
    '제출한 내용은 접수·상담용이며, 확정 안내 전까지 계약·예약 확정으로 보지 않습니다. 회사는 상담 신청 또는 예약 요청이 접수되었다는 사정만으로 예약 또는 계약이 확정된 것으로 보지 않습니다. 상담연결형 서비스는 외부 공급사 또는 실제 계약 당사자의 승낙 및 예약 확정 시에 계약이 성립합니다.',
    'app/terms/page.tsx',
    ['booking'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
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
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
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
    'common',
    ['package', 'fit', 'air', 'hotel', 'private'],
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
    ['booking', 'departure'],
    'package',
  ),
  inquiry(
    'inquiry-passport-name',
    '외국인 예약에 여권 정보가 필요한가요?',
    supportAnswer('faq-11'),
    'lib/support-content.ts',
    ['passport', 'booking'],
  ),
  inquiry(
    'inquiry-confirm-when',
    '예약 확정 안내는 언제 오나요?',
    `${supportAnswer('faq-1')} 상담연결형 상품의 계약은 외부 공급사 또는 실제 계약 당사자의 승낙 및 예약 확정 시에 성립합니다.`,
    'lib/support-content.ts',
    ['booking', 'process'],
  ),
  inquiry(
    'inquiry-departure-fixed',
    '단체 상품의 출발은 언제 확정되나요?',
    supportAnswer('faq-12'),
    'lib/support-content.ts',
    ['booking', 'departure'],
    'package',
  ),
  inquiry(
    'inquiry-change-itinerary',
    '일정은 바꿀 수 있나요?',
    supportAnswer('faq-9'),
    'lib/support-content.ts',
    ['cancel'],
    'package',
  ),
  inquiry(
    'inquiry-change-request',
    '접수한 일정·인원·조건을 다시 바꿀 수 있나요?',
    supportAnswer('faq-16'),
    'lib/support-content.ts',
    ['booking'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
  ),
  inquiry(
    'inquiry-traveler-info',
    '예약할 때 여행자 정보를 내야 하나요?',
    '예약 신청 또는 상품 진행 상담 시, 실제 예약·발권·숙박·보험·행사에 필요한 경우에 한해 여행자 정보(성명, 생년월일 등)와 여권정보, 영문명, 비자 관련 정보를 추가로 받습니다.',
    'app/privacy/page.tsx',
    ['passport', 'booking'],
  ),
  inquiry(
    'inquiry-air-separate',
    '여행상품과 따로 항공권만 예매할 수 있나요?',
    '항공 예약·발권으로 항공권 예매를 진행할 수 있습니다. 항공사와 운임 조건에 따라 발권 방식이 다를 수 있으며, 필요한 절차는 진행 과정에서 안내합니다.',
    'lib/air-ticketing-content.ts',
    ['booking'],
    'air',
    ['fit'],
  ),
  inquiry(
    'inquiry-single-room',
    '1인실을 요청할 수 있나요?',
    '예약 상담 화면에서 1인실 사용을 요청할 수 있습니다. 그 화면에는 가능 여부나 추가 금액이 적혀 있지 않습니다.',
    'app/components/travel/BookingIntakeModal.tsx',
    ['booking', 'extra-fee'],
    'package',
  ),
  inquiry(
    'inquiry-shopping',
    '쇼핑 환불은 어떻게 되나요?',
    '쇼핑 일정과 환불 규정은 상품과 현지 운영에 따라 달라요. 상품 페이지의 쇼핑정보를 먼저 확인해 주시고, 구매하신 물건의 환불은 담당자가 상품 조건을 확인해 안내해 드릴게요.',
    'app/components/detail/ModetourShoppingTable.tsx',
    ['refund', 'shopping'],
    'package',
  ),
  inquiry(
    'fit-what',
    '자유여행은 무엇을 준비하나요?',
    '항공과 호텔을 함께 준비하고, 추천일정까지 참고할 수 있는 자유여행 상품입니다.',
    'app/travel/air-hotel/page.tsx',
    ['booking'],
    'fit',
    ['hotel'],
  ),
  inquiry(
    'hotel-only',
    '호텔만 필요할 때는 어떤 안내를 보나요?',
    '항공과 호텔만 필요할 때. 국내 유명 여행사에서 검증된 호텔과 저렴한 항공권으로 가는 자유여행.',
    'app/components/home/AirHotelProductGridClient.tsx',
    ['booking'],
    'hotel',
  ),
  inquiry(
    'training-hub',
    '국외연수는 어떤 범위로 문의하나요?',
    '정부·공공·기업 목적의 국외 연수·교육여행 안내와 문의 접수입니다. 연수·전세버스·발권·통역 운영은 상담 후 안내됩니다.',
    'app/business/page.tsx',
    ['booking'],
    'training',
  ),
  inquiry(
    'institution-what',
    '연수기관 섭외는 어떤 문의인가요?',
    '해외 기관 방문·교류·레퍼런스 확인 등 기관 측 섭외가 필요한 경우에 맞춰 접수합니다. 일반 패키지 여행 상담과 성격이 다를 수 있습니다.',
    'lib/inquiry-page.ts',
    ['booking'],
    'institution',
  ),
  inquiry(
    'private-what',
    '우리끼리는 어떤 여행인가요?',
    '가족·지인·소규모 단체가 함께하는 단독 일정으로, 동선과 속도를 맞춰 제안합니다.',
    'lib/main-hub-copy.ts',
    ['booking'],
    'private',
  ),
  inquiry(
    'bus-info',
    '전세버스 견적에 어떤 정보를 남기나요?',
    '이용 인원, 출발지와 도착지, 이용 날짜, 출발 시간과 종료 예상 시간, 왕복·대기, 경유지, 차량 종류, 기사 대기 시간을 확인합니다. 차량 종류 예시에는 9인승, 25인승, 28인승, 45인승이 있습니다.',
    'app/components/charter-bus/CharterBusLanding.tsx',
    ['booking'],
    'bus',
  ),
  inquiry(
    'package-entry',
    '패키지 상담은 어디서 시작하나요?',
    '해외여행상품은 상담 후 확정하는 안내입니다. 상담 신청은 여행 상담 접수로 이어집니다. 즉시 결제·자동 확정이 아닌 상담·접수 창구입니다.',
    'lib/main-hub-copy.ts',
    ['booking'],
    'package',
  ),
  inquiry(
    'inquiry-organizer',
    '행사와 판매는 누가 하나요?',
    '실제 행사는 상품마다 해당 여행사와 현지 랜드사에서 진행하고, 봉투어는 판매를 대행하고 있어요. 어느 여행사 행사인지는 상품 페이지 안내에서 확인하실 수 있어요.',
    'app/components/detail/OrganizerNotice.tsx',
    ['booking'],
  ),
  inquiry(
    'fit-path',
    '자유여행 화면은 어디인가요?',
    '헤더의 자유여행은 항공과 호텔 페이지로 이동합니다.',
    'app/components/Header.tsx',
    ['booking'],
    'fit',
    ['hotel'],
  ),
  inquiry(
    'fit-hub',
    '자유여행 일정은 어떻게 맞추나요?',
    '항공과 숙소를 원하는 조합으로 맞추는 자유·에어텔 성격 일정입니다. 세부는 상담에서 정리합니다.',
    'lib/main-hub-copy.ts',
    ['booking'],
    'fit',
    ['hotel'],
  ),
  inquiry(
    'fit-not-instant',
    '자유여행은 문의와 동시에 결제되나요?',
    '즉시 결제·자동 확정이 아닌 상담·접수 창구입니다. 세부 조건은 확인 과정에서 정리됩니다.',
    'lib/main-hub-copy.ts',
    ['booking', 'payment'],
    'fit',
    ['package', 'hotel', 'private'],
  ),
  inquiry(
    'air-lead',
    '항공권만 예매할 때 무엇을 함께 보나요?',
    '항공권 예매는 단순 좌석 예약만이 아니라, 운임 조건, 결제 방식, 발권 가능 여부, 제출 서류 확인까지 함께 검토해야 하는 경우가 있습니다.',
    'lib/air-ticketing-content.ts',
    ['booking'],
    'air',
  ),
  inquiry(
    'air-general',
    '항공권 예매 안내는 어디까지인가요?',
    '일반 예매부터 상황별 발권 안내까지 가능합니다.',
    'lib/air-ticketing-content.ts',
    ['booking'],
    'air',
  ),
  inquiry(
    'air-corp-card',
    '항공권을 법인카드로 결제할 수 있나요?',
    '법인카드로 항공권 발급이 가능합니다. 다만 발급 과정에서 확인을 위해 명함, 사원증, 재직증명서 등의 서류가 필요할 수 있습니다.',
    'lib/air-ticketing-content.ts',
    ['payment'],
    'air',
    ['training'],
  ),
  inquiry(
    'air-differs',
    '항공권 진행 방식은 항상 같나요?',
    '항공사, 운임, 발권처에 따라 진행 방식이 달라질 수 있습니다.',
    'lib/air-ticketing-content.ts',
    ['booking'],
    'air',
  ),
  inquiry(
    'air-receipt-standalone',
    '항공권만 결제하면 현금영수증이 되나요?',
    '항공권만 단독으로 결제하는 경우에는 현금영수증 발행이 불가능합니다. 다만 E-ticket에 표시된 금액을 기준으로 증빙자료로 활용하실 수 있습니다.',
    'lib/air-ticketing-content.ts',
    ['payment'],
    'air',
  ),
  inquiry(
    'air-inquiry-path',
    '항공권 안내에서 문의는 어디로 가나요?',
    '항공권 예매 및 발권 안내의 문의는 여행 상담 접수로 이어집니다.',
    'app/components/air-ticketing/AirTicketingHub.tsx',
    ['booking'],
    'air',
  ),
  inquiry(
    'institution-scope',
    '연수기관 섭외만 맡기면 무엇을 하나요?',
    '연수 목적에 맞는 기관 조사·접촉·수용 가능 여부 확인 중심으로 지원합니다. 일정의 큰 틀이 이미 잡혀 있고 방문기관 섭외만 필요할 때 맞습니다.',
    'app/components/training/TrainingHub.tsx',
    ['booking'],
    'institution',
  ),
  inquiry(
    'institution-contact',
    '기관 섭외는 어떻게 확인하나요?',
    '연수 목적에 맞는 기관 조사, 서면 요청, 직접 연락, 방문 가능 여부 확인 중심으로 상담합니다.',
    'app/components/training/TrainingHub.tsx',
    ['process'],
    'institution',
    ['training'],
  ),
  inquiry(
    'institution-flow',
    '기관 조사는 문의 다음 어디에 있나요?',
    '기본 정보를 확인하고 현재 준비 범위에서 상담을 시작합니다. 이어서 목적 확인 후 유관기관 조사와 접촉 가능성을 검토합니다.',
    'app/components/training/TrainingHub.tsx',
    ['process'],
    'institution',
    ['training'],
  ),
  inquiry(
    'institution-not-tour',
    '기관 방문 일정은 관광 일정인가요?',
    '관광형 일정이 아니라 연수 목적 중심으로 방문 흐름을 재구성합니다.',
    'app/components/training/TrainingHub.tsx',
    ['booking'],
    'institution',
    ['training'],
  ),
  inquiry(
    'training-services',
    '국외연수 문의에서 고르는 범위는 무엇인가요?',
    '연수기관 섭외만, 연수기획·진행 및 연수기관 섭외, 연수기획·진행만 중에서 필요한 서비스 범위를 고릅니다.',
    'components/inquiry/TrainingInquiryForm.tsx',
    ['booking'],
    'training',
    ['institution'],
  ),
  inquiry(
    'training-unfixed',
    '국외연수는 세부 조건이 없어도 접수되나요?',
    '기관명, 희망 국가, 연수 목적, 인원 등 기본 정보를 접수합니다. 세부 조건이 모두 확정되지 않아도 접수 가능합니다.',
    'app/components/training/TrainingHub.tsx',
    ['booking'],
    'training',
    ['institution'],
  ),
  inquiry(
    'training-quote-mode',
    '국외연수 견적 문의와 간단 접수는 어떻게 다르나요?',
    '견적 문의는 목적지·출발 시기·인원이 필요합니다. 기관명 등은 선택으로 입력할 수 있습니다. 추가정보 입력은 선택입니다.',
    'components/inquiry/TrainingInquiryForm.tsx',
    ['booking'],
    'training',
  ),
  inquiry(
    'training-reply',
    '국외연수 문의 후 연락은 어떻게 오나요?',
    '문의가 접수되면 선택하신 답변 방법을 기준으로 순차적으로 안내합니다. 답변 방법은 이메일, 카카오톡, 둘 다 중에서 고르며 선택은 선택 항목입니다.',
    'components/inquiry/TrainingInquiryForm.tsx',
    ['process'],
    'training',
    ['institution'],
  ),
  inquiry(
    'training-docs',
    '국외연수에 발권·증빙도 포함되나요?',
    '국외연수는 항공 발권, 증빙, 확인 서류, 예산 집행 흐름까지 함께 검토해야 하는 경우가 많습니다. 진행 상황에 맞춰 필요한 내용을 안내합니다.',
    'app/components/training/TrainingHub.tsx',
    ['payment'],
    'training',
  ),
  inquiry(
    'training-interpreter',
    '연수 현장 통역은 어떻게 준비하나요?',
    '기관방문·회의·연구시찰은 순차통역 중심으로 준비하며, 사전질의서 기반 언어 준비를 함께 진행합니다.',
    'app/components/training/TrainingHub.tsx',
    ['process'],
    'training',
    ['institution'],
  ),
  inquiry(
    'private-pace',
    '우리끼리는 다른 팀 일정에 맞추나요?',
    '다른 팀 일정에 맞출 필요 없이, 우리 일행의 속도와 분위기에 맞춰 상담합니다.',
    'app/travel/overseas/private-trip/_components/PrivateTripLanding.tsx',
    ['booking'],
    'private',
  ),
  inquiry(
    'private-who',
    '우리끼리는 어떤 모임에 맞나요?',
    '가족여행, 동호회 여행, 소규모 단체여행처럼 구성에 맞는 흐름으로 방향을 잡습니다.',
    'app/travel/overseas/private-trip/_components/PrivateTripLanding.tsx',
    ['booking'],
    'private',
  ),
  inquiry(
    'private-base',
    '우리끼리 제안은 무엇을 기준으로 하나요?',
    '등록된 여행상품을 기준으로 현실적으로 가능한 맞춤여행 방향을 제안합니다.',
    'app/travel/overseas/private-trip/_components/PrivateTripLanding.tsx',
    ['booking'],
    'private',
  ),
  inquiry(
    'private-label',
    '우리견적 문의는 어떤 접수로 저장되나요?',
    '여행 상담이면서 우리견적인 문의는 우리견적 문의로 표시됩니다.',
    'lib/admin-inquiry.ts',
    ['booking'],
    'private',
  ),
  inquiry(
    'private-required',
    '우리견적에 꼭 적는 항목은 무엇인가요?',
    '희망 여행지 또는 국가/도시, 출발 희망일 또는 출발 희망월 중 하나, 1명 이상의 인원, 10자 이상의 문의 내용이 필요합니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
    'private',
  ),
  inquiry(
    'name-rule',
    '신청자 이름은 어떻게 적나요?',
    '이름은 2~30자 한글·영문·공백만 입력합니다.',
    'lib/customer-inquiry-intake.ts',
    ['booking'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
  ),
  inquiry(
    'status-flow',
    '접수 후 관리 상태는 어떻게 바뀌나요?',
    '문의 상태는 접수, 검토중, 연락중, 연락완료, 견적, 일정조율, 종료, 취소, 종료(불발)로 구분합니다.',
    'lib/admin-inquiry.ts',
    ['process'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
  ),
  inquiry(
    'bus-cases',
    '전세버스는 어떤 이동에 쓰나요?',
    '기업/기관 이동, 학교/학원 일정, 행사/모임 이동, 관광/자유 일정 이동에 맞춰 상담합니다.',
    'app/components/charter-bus/CharterBusLanding.tsx',
    ['booking'],
    'bus',
  ),
  inquiry(
    'bus-flow',
    '전세버스 견적은 어떤 순서로 안내되나요?',
    '기본 정보 접수 후 조건을 확인하고, 가능 여부와 예상 견적 방향을 상담한 뒤 일정을 조율하고, 확정 가능한 범위의 후속 절차를 안내합니다.',
    'app/components/charter-bus/CharterBusLanding.tsx',
    ['process'],
    'bus',
  ),
  inquiry(
    'bus-required',
    '전세버스에서 반드시 적는 항목은 무엇인가요?',
    '예상 인원은 필수이며 왕복 기준으로 1명 이상입니다. 전세버스 문의는 왕복 운행을 기준으로 접수합니다.',
    'components/inquiry/BusInquiryForm.tsx',
    ['booking'],
    'bus',
  ),
  inquiry(
    'bus-optional',
    '전세버스의 날짜와 장소는 없어도 접수되나요?',
    '이용 날짜, 이용 희망 월, 출발 시간, 종료 예상 시간, 출발지, 도착지, 경유지, 단체명은 선택입니다. 미정이어도 접수할 수 있고 자세한 일정과 차량 조건은 상담하면서 안내합니다.',
    'components/inquiry/BusInquiryForm.tsx',
    ['booking'],
    'bus',
  ),
  inquiry(
    'bus-vehicles',
    '전세버스 희망 차량은 무엇을 고르나요?',
    '희망 차량 종류는 선택이며 25인승, 28인승, 45인승, 기타 중에서 고를 수 있습니다. 기사 대기 시간과 짐 적재가 필요한지도 선택할 수 있습니다.',
    'components/inquiry/BusInquiryForm.tsx',
    ['booking'],
    'bus',
  ),
  inquiry(
    'bus-contact',
    '전세버스 답변 방법은 어떻게 고르나요?',
    '답변받을 방법은 선택입니다. 이메일로 답변받기, 카카오톡으로 상담받기, 둘 다 가능 중에서 고릅니다. 카카오톡을 고르면 연락 가능한 번호를 남기고, 확인 후 순차적으로 안내합니다.',
    'components/inquiry/BusInquiryForm.tsx',
    ['process'],
    'bus',
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
  officialEsim(
    'esim-reg-wifi',
    '등록이 안 될 때 Wi-Fi는 무엇을 확인하나요?',
    'Wi-Fi 신호를 확인하세요. 보안되지 않은 네트워크 같은 보안 경고가 있는 Wi-Fi에서는 등록이 되지 않을 수 있고, 핫스팟으로 등록하는 것도 되지 않을 수 있습니다.',
  ),
  officialEsim(
    'esim-reg-manual-ios',
    'QR이 안 읽히면 아이폰에서 어떻게 직접 입력하나요?',
    '설정 > 셀룰러 > eSIM 추가(또는 셀룰러 요금제 추가) > QR 코드 사용 > 세부사항 직접 입력에서 SM-DP 주소와 활성화 코드를 붙여 넣습니다. 확인코드는 비웁니다. 붙여 넣을 때 공백을 지웁니다.',
  ),
  officialEsim(
    'esim-reg-manual-android',
    'QR이 안 읽히면 안드로이드에서 어떻게 직접 입력하나요?',
    '설정 > 연결 > SIM 관리자 > eSIM 추가 > 활성화 코드 입력입니다. 붙여 넣을 때 공백을 지웁니다.',
  ),
  officialEsim(
    'esim-reg-reset',
    '그래도 등록이 안 되면 네트워크 설정을 지우나요?',
    '아이폰은 설정 > 일반 > 전송 또는 iPhone 재설정 > 재설정 > 네트워크 설정 재설정입니다. 안드로이드는 설정 > 일반 > 초기화 > 네트워크 설정 초기화입니다. 저장된 Wi-Fi 정보가 지워질 수 있습니다. 그래도 안 되면 고객센터로 문의합니다.',
  ),
  officialEsim(
    'esim-carrier-popup',
    '설치 후 이동통신사 설정 업데이트 팝업은 어떻게 하나요?',
    '팝업이 뜨면 \'지금 안 함\'을 눌러 주세요.',
  ),
  officialEsim(
    'esim-add-ios',
    '아이폰 설정에서 eSIM을 어떻게 추가하나요?',
    '설정 > 셀룰러 > 셀룰러 요금제 추가 또는 eSIM 추가에서 QR을 스캔하거나 직접 입력합니다. 기기마다 메뉴 이름이 다를 수 있고, 설치에는 데이터나 Wi-Fi가 필요합니다.',
  ),
  officialEsim(
    'esim-add-android',
    '안드로이드 설정에서 eSIM을 어떻게 추가하나요?',
    '설정 > 연결 > SIM 카드 관리자 > 모바일 요금제 추가 또는 eSIM 추가에서 QR을 스캔하거나 개통 코드를 입력합니다. 기기마다 메뉴 이름이 다를 수 있고, 설치에는 데이터나 Wi-Fi가 필요합니다.',
  ),
  {
    id: 'esim-models',
    category: 'esim',
    question: '어떤 기종이 eSIM을 지원하나요?',
    answer:
      '이용 가능 기기 화면 기준입니다. 2018년에 나온 iPhone XR·XS 이후와 iPhone SE 2·3세대를 지원합니다. 국내 출시 삼성은 Z Fold4·Flip4와 S23 시리즈 이후이며, Galaxy S22 이전 국내 출시 모델은 지원되지 않습니다. 해외판은 규격이 다를 수 있으니 설정에 eSIM 추가 메뉴가 있는지 확인합니다. 중국 본토 내수용 iPhone은 대부분 지원되지 않습니다.',
    source: 'app/travel/esim/help/device-compatibility/page.tsx',
    sourceUrl: BDT002_URL,
    sourceNote:
      'usimsa 공식 FAQ BDT002, 조회 2026-11-16. 공식 목록의 A54·A55·A35, 해외 삼성 S20 이후, 홍콩·마카오 출시 단말은 이 페이지와 달라 고객 답에 넣지 않음.',
    topics: ['esim'],
  },
  officialEsim(
    'esim-data-roaming',
    'eSIM의 데이터 로밍은 켜야 하나요?',
    'eSIM 데이터 로밍을 켭니다. 현지 통신사 직접 상품은 로밍을 꺼야 할 수 있으니 상품 안내를 따릅니다.',
  ),
  officialEsim(
    'esim-airplane',
    '연결이 안 되면 비행기 모드를 어떻게 하나요?',
    '비행기 모드를 켰다가 끕니다.',
  ),
  officialEsim(
    'esim-apn',
    'APN은 어디에 넣고 값은 무엇인가요?',
    '아이폰은 설정 > 셀룰러 > 셀룰러 데이터 옵션 > 셀룰러 데이터 네트워크입니다. 안드로이드는 설정 > 연결 > 모바일 네트워크 > 액세스 포인트 이름 > eSIM > 추가입니다. APN 값은 국가·상품마다 다르므로 상품 안내 또는 고객센터에서 확인합니다.',
  ),
  officialEsim(
    'esim-install-window',
    '국내에서 미리 설치해도 되나요?',
    '상품에 따라 미리 설치할 수 있는 것과 없는 것이 있습니다. 미리 설치가 안 되는 상품은 설치하는 순간 개통되어 일수가 줄어들 수 있으니 설치 전에 상품 안내를 확인합니다.',
  ),
  officialEsim(
    'esim-local-install-error',
    '현지 통신사 상품을 국내에서 설치하면 실패로 보이나요?',
    '현지 통신사 상품을 국내에서 미리 설치하면 아이폰은 활성화 중 또는 eSIM 활성화에 실패, 안드로이드는 알 수 없음 또는 현재 사업자에서는 서비스가 지원되지 않습니다가 나올 수 있습니다. 이 표시는 정상일 수 있고 현지에서 사용할 수 있습니다.',
  ),
  officialEsim(
    'esim-voice',
    'eSIM으로 전화할 수 있나요?',
    '데이터 전용이며 현지 번호는 없습니다. 일부 상품은 예외일 수 있습니다. 보이스톡·페이스타임처럼 데이터로 하는 통화는 가능합니다. 듀얼심으로 한국 번호를 쓰고 받는 것은 가능하지만, 가입 통신사 로밍 요금이 나올 수 있어 그 정책은 통신사에 확인합니다.',
  ),
  officialEsim(
    'esim-hotspot',
    '핫스팟이나 테더링이 되나요?',
    '기본적으로 됩니다. 현지 통신사 정책과 트래픽에 따라 미리 알리지 않고 제한될 수 있습니다.',
  ),
  officialEsim(
    'esim-usage-phone',
    '휴대폰 설정에서 사용량은 어디서 보나요?',
    '아이폰은 설정 > 셀룰러 > 로밍 데이터 사용량입니다. 안드로이드는 설정 > 연결 > 데이터 사용 > 모바일 데이터 사용량입니다. 일부 상품은 남은 양을 볼 수 없습니다.',
  ),
  esim(
    'esim-usage-mypage',
    '마이페이지에서 사용량은 어디서 보나요?',
    'eSIM 주문에서 데이터 사용량 확인을 누르면 사용한 양을 보여 줍니다. 한도가 있으면 사용한 양과 총량을 함께 보여 줍니다.',
    'app/mypage/esim/MyEsimOrdersClient.tsx',
  ),
  officialEsim(
    'esim-remove-steps',
    '휴대폰에서 eSIM을 어떻게 지우나요?',
    '아이폰은 설정 > 셀룰러 > 해당 eSIM > eSIM 제거입니다. 안드로이드는 설정 > 연결 > SIM카드 관리자 > 해당 eSIM > 삭제입니다. QR은 한 번만 쓸 수 있고 지우면 다시 설치하지 못하는 경우가 많으니, 쓰는 동안에는 지우지 않습니다.',
  ),
  inquiry(
    'boss-hotel-only-later',
    '호텔만 단독으로 예약하는 절차는 무엇인가요?',
    '호텔만 단독 예약은 추후 API 연결 후 안내드릴 예정이라, 지금은 온라인으로 바로 진행되지 않아요. 원하시는 도시와 날짜를 남겨 주시면 상담원이 확인해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['booking'],
    'hotel',
  ),
  inquiry(
    'boss-quote-hours',
    '견적서는 몇 시간 안에 나오나요?',
    '견적서는 문의를 받은 뒤 3시간 안에 보내 드리는 것을 기준으로 하고 있어요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['process'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
  ),
  inquiry(
    'boss-passport-remain',
    '여권 잔여 유효기간은 얼마나 있어야 하나요?',
    '여권 남은 유효기간은 출발일을 기준으로 계산해요. 필요한 기간은 나라마다 달라서, 여행하실 나라를 알려 주시면 확인해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['passport'],
    'common',
    ['package', 'fit', 'private', 'training'],
  ),
  inquiry(
    'boss-visa-free',
    '무비자 국가 안내는 어떻게 구분하나요?',
    '무비자 국가 안내는 여행하실 나라와 여권 국적에 따라 달라져요. 나라와 여행 기간을 알려 주시면 담당자가 확인해 안내해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['visa'],
    'common',
    ['package', 'fit', 'private', 'training'],
  ),
  inquiry(
    'boss-visa-required',
    '사전 비자가 필요한 국가 안내는 어떻게 구분하나요?',
    '출발 전에 비자나 전자여행허가가 필요한 나라가 있어요. 사전 비자 필요 국가 안내는 나라와 여권 국적에 따라 달라서, 알려 주시면 필요한 서류를 확인해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['visa'],
    'common',
    ['package', 'fit', 'private', 'training'],
  ),
  inquiry(
    'boss-cancel-fee',
    '출발 며칠 전 취소 수수료는 몇 %인가요?',
    '취소 수수료는 상품별로 고지된 금액 기준으로 적용돼요. 상품 페이지의 취소 규정과 여행 표준약관을 바탕으로, 예약 내용을 확인한 뒤 정확한 금액을 안내해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['cancel', 'refund'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'private', 'training'],
  ),
  inquiry(
    'boss-deposit',
    '예약금·계약금은 얼마인가요?',
    '예약금은 상품과 인원에 따라 달라서, 금액과 입금 방법은 예약 상담 때 추후 안내해 드려요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['payment'],
    'common',
    ['package', 'fit', 'private', 'training', 'bus'],
  ),
  inquiry(
    'boss-child-age',
    '아동·유아 요금은 성인 요금의 몇 %인가요?',
    '아동·유아 요금은 각 여행상품에 적힌 나이 기준을 따름으로, 상품마다 기준 나이와 금액이 달라요. 요금표에 적혀 있지 않으면 상담원이 확인해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['payment', 'extra-fee'],
    'package',
    ['fit', 'private'],
  ),
  inquiry(
    'boss-optional-tour',
    '선택관광은 필수인가요, 비용은 얼마인가요?',
    '선택관광은 필수 아님(선택)이라 원하실 때만 참여하시면 돼요. 비용은 상품 페이지 현지옵션 안내에 적힌 금액과 통화 그대로를 기준으로 해요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['booking', 'shopping'],
    'package',
  ),
  inquiry(
    'boss-single-room',
    '1인실 추가 금액은 얼마인가요?',
    '1인실 추가 금액은 상품마다 달라서, 해당 상품은 1인실 금액 확인 후 안내해 드려요. 상품 안내에 금액이 적혀 있으면 그 금액 그대로 알려 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['payment', 'extra-fee'],
    'package',
  ),
  inquiry(
    'boss-name-fix',
    '발권 후 영문 이름을 어떻게 고치나요?',
    '발권 후 영문 이름 수정은 항공사 규약에 따릅니다. 항공사마다 가능 여부와 비용이 달라서, 예약번호와 함께 남겨 주시면 상담원이 확인해 드릴게요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['booking'],
    'air',
    ['package', 'fit', 'private'],
  ),
  inquiry(
    'boss-esim-topup',
    '데이터가 떨어지면 고객이 어떻게 충전하나요?',
    '충전 가능 여부는 상품별로 다름에 유의해 주세요. 이용 중인 상품명을 알려 주시면 고객센터에서 확인해 안내해 드려요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['esim'],
    'esim',
  ),
  inquiry(
    'boss-esim-speed',
    '어느 정도 속도가 정상인가요?',
    '정상 속도는 상품마다 달라서 상품별 고지 내용을 확인해 주세요. 고지보다 많이 느리면 고객센터 연결링크로 문의해 주세요.',
    'docs/talktalk-faq-inventory-1116.md',
    ['esim'],
    'esim',
  ),
  inquiry(
    'faq-seat-left',
    '원하는 날짜에 자리가 남아 있나요?',
    '출발일별 요금과 예약 가능 여부는 상품 페이지 달력에서 먼저 보실 수 있어요. 좌석은 수시로 바뀌기 때문에, 원하시는 날짜와 인원을 남겨 주시면 상담원이 남은 자리를 확인해 드릴게요.',
    'app/terms/page.tsx',
    ['seat', 'booking'],
    'package',
    ['fit', 'air', 'private'],
  ),
  inquiry(
    'faq-departure-confirmed',
    '제가 고른 날짜는 출발이 확정됐나요?',
    '단체 상품은 최소출발 인원이 모여야 출발이 확정돼요. 날짜별 확정 여부는 바뀔 수 있어서, 원하시는 출발일을 알려 주시면 지금 상태를 확인해 안내해 드릴게요.',
    'lib/support-content.ts',
    ['departure', 'booking'],
    'package',
  ),
  inquiry(
    'faq-included',
    '여행 요금에 무엇이 포함되고 무엇이 빠져 있나요?',
    '상품 페이지 아래쪽 포함/불포함사항에 항목별로 정리되어 있어요. 거기에 없는 내용이 궁금하시면 상품명과 함께 남겨 주세요. 담당자가 확인해 드릴게요.',
    'app/components/travel/ybtour/YbtourProductExtraInfoTabs.tsx',
    ['included'],
    'package',
    ['fit', 'private'],
  ),
  inquiry(
    'faq-fuel-surcharge',
    '유류할증료는 요금에 포함되어 있나요?',
    '상품마다 달라서 상품 페이지 포함/불포함사항에서 확인하실 수 있어요. 유류할증료와 세금은 발권 시점에 따라 바뀔 수 있어, 확정 금액은 예약 상담 때 다시 안내해 드려요.',
    'app/terms/page.tsx',
    ['included', 'payment'],
    'package',
    ['fit', 'air', 'private'],
  ),
  inquiry(
    'faq-guide-tip',
    '가이드 경비(팁)는 따로 내나요?',
    '상품마다 달라요. 가이드 경비가 요금에 들어 있는지는 상품 페이지 포함/불포함사항에 적혀 있고, 현지에서 따로 내는 금액은 상품 안내에 적힌 금액과 통화 그대로 안내해 드려요.',
    'app/components/travel/ybtour/YbtourProductExtraInfoTabs.tsx',
    ['included'],
    'package',
  ),
  inquiry(
    'faq-shopping-schedule',
    '쇼핑 일정이 들어 있나요?',
    '쇼핑 일정이 있는 상품은 상품 페이지 쇼핑정보에 들르는 곳이 정리되어 있어요. 쇼핑이 부담스러우시면 노쇼핑 상품으로 찾아 드릴 수 있으니 편하게 말씀해 주세요.',
    'app/components/travel/ybtour/YbtourProductExtraInfoTabs.tsx',
    ['shopping'],
    'package',
  ),
  inquiry(
    'faq-agent-connect',
    '상담원과 직접 이야기하고 싶어요.',
    "'상담원 연결'이라고 남겨 주시면 담당 상담원에게 바로 연결해 드려요. 상담 가능 시간에 순서대로 답변드리고 있어요.",
    'lib/talktalk-autoreply/reply.ts',
    ['agent', 'process'],
    'common',
    ['package', 'fit', 'air', 'hotel', 'training', 'institution', 'private', 'bus'],
  ),
]

/** 사장님 확인 후 남은 빈 질문. 12건은 모두 확정되어 비어 있다. */
export const TALKTALK_FAQ_NEEDS_ANSWER: readonly { question: string; why: string }[] = []

export function faqMemberships(item: TalktalkDraftFaqItem): TalktalkFaqCategory[] {
  return [item.category, ...(item.also ?? [])]
}

export function faqCountByCategory(): Record<TalktalkFaqCategory, number> {
  const counts = Object.fromEntries(TALKTALK_FAQ_CATEGORIES.map((c) => [c.id, 0])) as Record<
    TalktalkFaqCategory,
    number
  >
  for (const item of ADMIN_DRAFT_FAQ) {
    for (const category of faqMemberships(item)) counts[category] += 1
  }
  return counts
}

export function talktalkFaqAdminGroups(): Array<{
  id: TalktalkFaqCategory
  label: string
  items: Array<{ id: string; question: string; answer: string; source: string }>
}> {
  return TALKTALK_FAQ_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    items: ADMIN_DRAFT_FAQ.filter((item) => faqMemberships(item).includes(category.id)).map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      source: item.source,
    })),
  }))
}

export function customerFaqBlob(items: readonly TalktalkDraftFaqItem[] = ADMIN_DRAFT_FAQ): string {
  return items.map((item) => `${item.question}\n${item.answer}`).join('\n')
}

export function selectDraftFaq(inquiryText: string, limit = 4): TalktalkDraftFaqItem[] {
  const text = String(inquiryText ?? '')
  const category = inferTalktalkFaqCategory(text)
  const topics = new Set<TalktalkFaqTopic>()
  if (/취소|환불|변경/.test(text)) {
    topics.add('cancel')
    topics.add('refund')
  }
  if (/결제|카드|할부|영수증|현금/.test(text)) topics.add('payment')
  if (/예약|확정|접수|견적|단체|맞춤/.test(text)) topics.add('booking')
  if (/여권|영문/.test(text)) topics.add('passport')
  if (/진행|순서|상담/.test(text)) topics.add('process')
  if (/e\s*sim|이심|qr|설치|로밍|apn|갤럭시|아이폰|핫스팟|테더|사용량/i.test(text)) topics.add('esim')
  for (const t of talktalkSpecificTopicsForText(text)) topics.add(t)
  if (topics.size === 0) topics.add('booking')
  const topical = rankFaqByTopics(
    ADMIN_DRAFT_FAQ.filter((item) => item.topics.some((topic) => topics.has(topic))),
    topics,
    text,
  )
  const inCategory = topical.filter(
    (item) => faqMemberships(item).includes(category) || item.category === 'common',
  )
  const pool =
    category === 'esim'
      ? topical.filter((item) => faqMemberships(item).includes('esim'))
      : category === 'common'
        ? topical.filter((item) => !faqMemberships(item).every((c) => c === 'esim'))
        : inCategory
  return (pool.length > 0 ? pool : topical).slice(0, limit)
}
