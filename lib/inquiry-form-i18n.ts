/**
 * 문의 폼 `?lang=en` (bongtour.net 블로그 등).
 * 한글이 본문·제목·라벨 SSOT. 영문은 안내·주의 블록을 한글 다음에 두는 보조.
 * REGRESSION-FREEZE[inquiry-lang-en-korean-first]: 슬래시 병기 금지, 한글 안내·주의 후 영문 — manifest
 */
import type { InquiryKind, InquiryUiLang } from '@/lib/inquiry-page'
import { INQUIRY_UI_META } from '@/lib/inquiry-page'

/** 오류 등 한 문자열이어야 할 때만. 한글 다음 줄에 영문. ` / ` 병기 금지. */
function stackedError(lang: InquiryUiLang, ko: string, en: string): string {
  return lang === 'en' ? `${ko}\n${en}` : ko
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

/** 유형 칩은 한글만. 영문은 상단 안내 다음 줄. */
export function inquiryKindLabel(kind: InquiryKind, _lang?: InquiryUiLang): string {
  return INQUIRY_KIND_LABEL_KO[kind]
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

export function inquiryFormMeta(
  kind: InquiryKind,
  lang: InquiryUiLang,
): {
  title: string
  description: string
  titleEn: string | null
  descriptionEn: string | null
} {
  const ko = INQUIRY_UI_META[kind]
  if (lang !== 'en') {
    return { title: ko.title, description: ko.description, titleEn: null, descriptionEn: null }
  }
  const en = INQUIRY_UI_META_EN[kind]
  return {
    title: ko.title,
    description: ko.description,
    titleEn: en.title,
    descriptionEn: en.description,
  }
}

export function inquiryShellCopy(lang: InquiryUiLang) {
  const en = lang === 'en'
  return {
    breadcrumbHome: '홈',
    breadcrumbInquiry: '문의 접수',
    typeHelp: '문의 유형을 선택해 주세요. 유형에 따라 필요한 정보와 담당 흐름이 달라질 수 있습니다.',
    typeHelpEn: en ? 'Please choose an inquiry type. Required fields and follow-up can differ.' : null,
    eyebrow: '문의 접수',
    eyebrowEn: en ? 'Inquiry' : null,
    shortNotice: '제출하신 내용은 접수·상담용이며, 확정 안내 전까지 계약·예약 확정으로 보지 않습니다.',
    shortNoticeEn: en
      ? 'This is a consultation request only. It is not a confirmed booking or contract until we notify you.'
      : null,
    contactHeading: '연락처·문의 내용',
    extraHeading: '추가 정보 (선택)',
    name: '신청자 이름',
    nameEn: en ? 'Name' : null,
    phone: '연락처',
    phoneEn: en ? 'Phone#' : null,
    phoneHint: en ? '국가번호를 고른 뒤, 나머지 번호만 입력해 주세요.' : null,
    phoneHintEn: en ? 'Select a country code, then enter the rest of the number.' : null,
    email: '이메일',
    emailEn: en ? 'email' : null,
    optional: '(선택)',
    optionalEn: en ? '(optional)' : null,
    message: '문의 내용',
    messageEn: en ? 'Message' : null,
    messagePlaceholderEn: en
      ? 'Dates, party size, destination, or any questions'
      : null,
    productInquiry: '상품 문의',
    travelConsult: '여행 상담',
    privacyToggle: '개인정보 수집·이용 안내 보기',
    privacyTitle: '개인정보 수집·이용 안내',
    privacyBodyFallback: '개인정보 수집·이용 안내를 확인해 주세요.',
    privacyConsent: '개인정보 수집·이용 안내를 확인했습니다',
    privacyHint: '안내문 확인 후 체크해 주세요. 확인이 없으면 접수가 어렵습니다.',
    privacyHintEn: en
      ? 'Please check this box after reading the notice. We cannot accept the form without it.'
      : null,
    privacyRequired: stackedError(
      lang,
      '개인정보 처리에 동의해 주세요.',
      'Please agree to the privacy notice.',
    ),
    emailRequired: stackedError(lang, '이메일을 입력해 주세요.', 'Please enter your email.'),
    messageRequired: (label: string) =>
      stackedError(lang, `${label}을(를) 입력해 주세요.`, `Please enter ${label}.`),
    submit: '문의 접수하기',
    submitting: '접수 중…',
    submitHint: '버튼은 "접수"이며, 확정 안내 전까지 예약·계약이 성립한 것은 아닙니다.',
    submitHintEn: en ? 'This button only submits a request. It does not confirm a booking.' : null,
    fail: stackedError(
      lang,
      '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      'We could not submit the inquiry. Please try again shortly.',
    ),
    notPersisted: stackedError(
      lang,
      '접수가 완료되지 않았습니다. 3초 이상 입력 후 다시 시도해 주세요.',
      'The request was not saved. Please wait a few seconds and try again.',
    ),
    network: stackedError(
      lang,
      '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      'A network error occurred. Please try again shortly.',
    ),
    disclosureEn: en
      ? 'Bong Tour is a consultation desk, not an online store. Prices and schedules are based on supplier (travel agency) information. Submitting this form does not confirm a reservation.'
      : null,
    monthLabel: '희망 출발 월',
    monthHint: '선택 시 일정 촉박도 안내에 참고됩니다. 미선택도 가능합니다.',
    monthHintEn: en ? 'Optional. Helps us flag tight timelines.' : null,
    adult: '성인(만 12세 이상)',
    child: '아동(만 2세 이상~만 12세 미만)',
    infant: '유아(만 2세 미만)',
    paxHint: '인원 기준은 일반적인 여행 기준이며, 실제 적용은 상품/항공 규정에 따라 달라질 수 있습니다.',
    paxHintEn: en
      ? 'Age bands follow common tour practice; the supplier or airline rules may differ.'
      : null,
    region: '희망 지역·국가',
    regionPlaceholder: en ? 'e.g. Danang, Osaka, Swiss Alps' : '예: 다낭, 오사카, 스위스 알프스',
    marketing: '마케팅 정보 수신에 동의합니다',
    marketingToggle: '안내 보기',
    thankYouTitle: '요청 접수 완료',
    thankYouHeadline: '여행 상담 문의가 접수되었습니다',
    thankYouLinesKo: en
      ? [
          '일정·인원·요금은 상담을 통해 조율하며, 최종 조건은 공급사(여행사) 확인 후 확정됩니다.',
          '잔여석·요금 변동이 있을 수 있으니, 연락 시 함께 안내드리겠습니다.',
        ]
      : null,
    thankYouLinesEn: en
      ? [
          'Dates, party size, and price are confirmed after consultation with the supplier (travel agency).',
          'Availability and rates can change; we will explain this when we contact you.',
        ]
      : null,
    home: '홈으로',
    anotherInquiry: '다른 문의하기',
  }
}
