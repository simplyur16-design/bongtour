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
    source: 'usimsa 공식 FAQ BDT002',
    sourceUrl: BDT002_URL,
    sourceNote: '조회 2026-11-16',
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
    ['booking'],
  ),
  inquiry(
    'inquiry-change-itinerary',
    '일정은 바꿀 수 있나요?',
    supportAnswer('faq-9'),
    'lib/support-content.ts',
    ['cancel'],
  ),
  inquiry(
    'inquiry-change-request',
    '접수한 일정·인원·조건을 다시 바꿀 수 있나요?',
    supportAnswer('faq-16'),
    'lib/support-content.ts',
    ['booking'],
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
  ),
  inquiry(
    'inquiry-single-room',
    '1인실을 요청할 수 있나요?',
    '예약 상담 화면에서 1인실 사용을 요청할 수 있습니다. 그 화면에는 가능 여부나 추가 금액이 적혀 있지 않습니다.',
    'app/components/travel/BookingIntakeModal.tsx',
    ['booking'],
  ),
  inquiry(
    'inquiry-shopping',
    '쇼핑 환불은 어떻게 되나요?',
    '쇼핑 일정·환불 규정은 현지 및 공급사 운영에 따라 달라질 수 있습니다.',
    'app/components/detail/ModetourShoppingTable.tsx',
    ['refund'],
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
    '지금 안 함을 누릅니다.',
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
    question: '선택관광은 필수인가요, 비용은 얼마인가요?',
    why: '상품마다 표가 다르고, 필수 여부와 금액을 정한 공통 문장이 없습니다.',
  },
  {
    question: '1인실 추가 금액은 얼마인가요?',
    why: '상담 화면의 1인실 요청 외에 금액 규정이 없습니다.',
  },
  {
    question: '발권 후 영문 이름을 어떻게 고치나요?',
    why: '여행자 정보를 받는다는 문구만 있고, 정정 절차는 없습니다.',
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
  if (/e\s*sim|이심|qr|설치|로밍|apn|갤럭시|아이폰|핫스팟|테더|사용량/i.test(text)) topics.add('esim')
  if (topics.size === 0) topics.add('booking')
  return ADMIN_DRAFT_FAQ.filter((item) => item.topics.some((topic) => topics.has(topic))).slice(0, limit)
}
