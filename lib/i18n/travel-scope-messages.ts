/**
 * 영문 확장 사전 준비: 국내여행 + 전세버스 범위만.
 * 라우팅 전환 없이 copy 소스로 사용 → 추후 `useLocale()` 등에 연결.
 */
export type TravelLocale = 'ko' | 'en'

const M = {
  ko: {
    cta: {
      requestConsultation: '상담 신청',
      contactUs: '문의하기',
      notBookingConfirmation: '일정·요금은 상담 시 확정되며, 이 페이지만으로 예약이 확정되지 않습니다.',
    },
    transport: {
      AIR: '항공',
      SHIP: '선박',
      BUS: '버스',
      TRAIN: '열차·철도',
      SELF: '개별 집결',
      MIXED: '복합 교통',
      ETC: '기타',
    },
    charter: {
      pageTitle: '전세버스',
      quoteIntro: '견적·이용 절차',
      inquirySubmit: '견적 문의 보내기',
    },
  },
  en: {
    cta: {
      requestConsultation: 'Request consultation',
      contactUs: 'Contact us',
      notBookingConfirmation:
        'Dates and fares are confirmed after consultation; viewing this page does not confirm a booking.',
    },
    transport: {
      AIR: 'Flight',
      SHIP: 'Ferry / ship',
      BUS: 'Coach',
      TRAIN: 'Train',
      SELF: 'Meet on site / self-arranged',
      MIXED: 'Mixed transport',
      ETC: 'Other',
    },
    charter: {
      pageTitle: 'Charter bus',
      quoteIntro: 'Quotation & process',
      inquirySubmit: 'Send a quote request',
    },
  },
} as const satisfies Record<TravelLocale, Record<string, Record<string, string>>>

export function travelScopeMessages(locale: TravelLocale) {
  return M[locale]
}

export function transportLabel(locale: TravelLocale, key: keyof typeof M.ko.transport): string {
  return M[locale].transport[key] ?? key
}
