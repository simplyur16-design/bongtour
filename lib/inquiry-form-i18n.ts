/**
 * 문의 폼 한/영 병기 — `?lang=en` (bongtour.net 블로그 등).
 * 한국어 기본 화면은 기존 문구 그대로.
 */
import type { InquiryKind, InquiryUiLang } from '@/lib/inquiry-page'
import { INQUIRY_UI_META } from '@/lib/inquiry-page'

export function inquiryDual(lang: InquiryUiLang, ko: string, en: string): string {
  return lang === 'en' ? `${ko} / ${en}` : ko
}

export const INQUIRY_KIND_LABEL_EN: Record<InquiryKind, string> = {
  travel: 'Travel consult',
  institution: 'Institution visit',
  training: 'Overseas training',
  bus: 'Charter bus',
}

export const INQUIRY_KIND_LABEL_KO: Record<InquiryKind, string> = {
  travel: '여행 상담',
  institution: '기관 섭외',
  training: '국외 연수',
  bus: '버스 견적',
}

export function inquiryKindLabel(kind: InquiryKind, lang: InquiryUiLang): string {
  return inquiryDual(lang, INQUIRY_KIND_LABEL_KO[kind], INQUIRY_KIND_LABEL_EN[kind])
}

export const INQUIRY_UI_META_EN: Record<InquiryKind, { title: string; description: string }> = {
  travel: {
    title: 'Travel consultation request',
    description:
      'Leave dates, party size, and destination. A coordinator will review and contact you. Submitting this form does not confirm a booking; final terms follow the supplier (travel agency).',
  },
  institution: {
    title: 'Institution visit request',
    description:
      'Use this form when you need help arranging visits or exchanges with overseas institutions. This is different from a standard package-tour consult.',
  },
  training: {
    title: 'Overseas training inquiry',
    description:
      'You can submit with the required fields only. A coordinator will follow up. Submitting this form does not confirm a booking.',
  },
  bus: {
    title: 'Charter bus inquiry',
    description:
      'Estimated headcount is enough to start. Charter buses are quoted round-trip; routing and vehicles are confirmed in consultation. Submitting this form does not confirm dispatch.',
  },
}

export function inquiryFormMeta(kind: InquiryKind, lang: InquiryUiLang): { title: string; description: string } {
  const ko = INQUIRY_UI_META[kind]
  if (lang !== 'en') return ko
  const en = INQUIRY_UI_META_EN[kind]
  return {
    title: inquiryDual(lang, ko.title, en.title),
    description: `${ko.description}\n\n${en.description}`,
  }
}

export function inquiryShellCopy(lang: InquiryUiLang) {
  return {
    breadcrumbHome: inquiryDual(lang, '홈', 'Home'),
    breadcrumbInquiry: inquiryDual(lang, '문의 접수', 'Inquiry'),
    typeHelp: inquiryDual(
      lang,
      '문의 유형을 선택해 주세요. 유형에 따라 필요한 정보와 담당 흐름이 달라질 수 있습니다.',
      'Choose a type. Required fields and the follow-up flow can differ.',
    ),
    currentType: (label: string) =>
      lang === 'en' ? `현재 선택 / Selected: ${label}` : `현재 선택: ${label}`,
    eyebrow: inquiryDual(lang, '문의 접수', 'Inquiry'),
    shortNotice: inquiryDual(
      lang,
      '제출하신 내용은 접수·상담용이며, 확정 안내 전까지 계약·예약 확정으로 보지 않습니다.',
      'This is a consultation request only. It is not a confirmed booking or contract until we notify you.',
    ),
    contactHeading: inquiryDual(lang, '연락처·문의 내용', 'Contact & message'),
    extraHeading: inquiryDual(lang, '추가 정보 (선택)', 'Additional details (optional)'),
    name: inquiryDual(lang, '신청자 이름', 'Name'),
    phone: inquiryDual(lang, '연락처', 'Phone'),
    phoneHint:
      lang === 'en'
        ? '한국 번호 또는 국가번호 포함 해외 번호 / Korean or international number with country code'
        : null,
    email: inquiryDual(lang, '이메일', 'Email'),
    optional: inquiryDual(lang, '(선택)', '(optional)'),
    message: inquiryDual(lang, '문의 내용', 'Message'),
    productInquiry: inquiryDual(lang, '상품 문의', 'Product inquiry'),
    travelConsult: inquiryDual(lang, '여행 상담', 'Travel consult'),
    privacyToggle: inquiryDual(lang, '개인정보 수집·이용 안내 보기', 'View privacy notice'),
    privacyTitle: inquiryDual(lang, '개인정보 수집·이용 안내', 'Privacy notice'),
    privacyBodyFallback: inquiryDual(
      lang,
      '개인정보 수집·이용 안내를 확인해 주세요.',
      'Please read the privacy notice.',
    ),
    privacyConsent: inquiryDual(
      lang,
      '개인정보 수집·이용 안내를 확인했습니다',
      'I have read the privacy notice',
    ),
    privacyHint: inquiryDual(
      lang,
      '안내문 확인 후 체크해 주세요. 확인이 없으면 접수가 어렵습니다.',
      'Please check this box after reading the notice. We cannot accept the form without it.',
    ),
    privacyRequired: inquiryDual(lang, '개인정보 처리에 동의해 주세요.', 'Please agree to the privacy notice.'),
    emailRequired: inquiryDual(lang, '이메일을 입력해 주세요.', 'Please enter your email.'),
    messageRequired: (label: string) =>
      lang === 'en' ? `Please enter ${label}.` : `${label}을(를) 입력해 주세요.`,
    submit: inquiryDual(lang, '문의 접수하기', 'Submit inquiry'),
    submitting: inquiryDual(lang, '접수 중…', 'Submitting…'),
    submitHint: inquiryDual(
      lang,
      '버튼은 "접수"이며, 확정 안내 전까지 예약·계약이 성립한 것은 아닙니다.',
      'This button only submits a request. It does not confirm a booking.',
    ),
    fail: inquiryDual(
      lang,
      '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      'We could not submit the inquiry. Please try again shortly.',
    ),
    notPersisted: inquiryDual(
      lang,
      '접수가 완료되지 않았습니다. 3초 이상 입력 후 다시 시도해 주세요.',
      'The request was not saved. Please wait a few seconds and try again.',
    ),
    network: inquiryDual(
      lang,
      '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      'A network error occurred. Please try again shortly.',
    ),
    disclosureEn:
      lang === 'en'
        ? 'Bong Tour is a consultation desk, not an online store. Prices and schedules are based on supplier (travel agency) information. Submitting this form does not confirm a reservation.'
        : null,
    monthLabel: inquiryDual(lang, '희망 출발 월', 'Preferred departure month'),
    monthHint: inquiryDual(
      lang,
      '선택 시 일정 촉박도 안내에 참고됩니다. 미선택도 가능합니다.',
      'Optional. Helps us flag tight timelines.',
    ),
    adult: inquiryDual(lang, '성인(만 12세 이상)', 'Adults (age 12+)'),
    child: inquiryDual(lang, '아동(만 2세 이상~만 12세 미만)', 'Children (age 2–11)'),
    infant: inquiryDual(lang, '유아(만 2세 미만)', 'Infants (under 2)'),
    paxHint: inquiryDual(
      lang,
      '인원 기준은 일반적인 여행 기준이며, 실제 적용은 상품/항공 규정에 따라 달라질 수 있습니다.',
      'Age bands follow common tour practice; the supplier or airline rules may differ.',
    ),
    region: inquiryDual(lang, '희망 지역·국가', 'Preferred region or country'),
    regionPlaceholder:
      lang === 'en' ? 'e.g. Danang, Osaka, Swiss Alps' : '예: 다낭, 오사카, 스위스 알프스',
    marketing: inquiryDual(lang, '마케팅 정보 수신에 동의합니다', 'I agree to receive marketing updates'),
    marketingToggle: inquiryDual(lang, '안내 보기', 'View notice'),
    thankYouTitle: inquiryDual(lang, '요청 접수 완료', 'Request received'),
    thankYouHeadline: inquiryDual(lang, '여행 상담 문의가 접수되었습니다', 'Your travel inquiry was received'),
    thankYouLines:
      lang === 'en'
        ? [
            '일정·인원·요금은 상담을 통해 조율하며, 최종 조건은 공급사(여행사) 확인 후 확정됩니다.',
            'Dates, party size, and price are confirmed after consultation with the supplier (travel agency).',
            '잔여석·요금 변동이 있을 수 있으니, 연락 시 함께 안내드리겠습니다.',
            'Availability and rates can change; we will explain this when we contact you.',
          ]
        : null,
    home: inquiryDual(lang, '홈으로', 'Home'),
    anotherInquiry: inquiryDual(lang, '다른 문의하기', 'Submit another inquiry'),
  }
}
