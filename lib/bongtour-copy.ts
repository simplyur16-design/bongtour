/**
 * Bong투어 공통 카피 — CTA·고지·완료 문구.
 * (P1) UI에서만 사용. DB/API와 무관.
 */

/** CTA 버튼 기본 라벨 (쇼핑몰형 표현 금지) */
export const CTA_LABELS = {
  bookRequest: '예약신청하기',
  consult: '상담 신청하기',
  customItinerary: '맞춤 일정 문의하기',
  kakao: '카카오로 문의하기',
  phone: '전화 문의하기',
} as const

export type BongtourCtaVariant = keyof typeof CTA_LABELS

/** 공급사 관계·역할 안내 */
export const SUPPLIER_RELATION_COPY = {
  title: 'Bong투어와 공급사(여행사) 관계',
  /** 일반(설명형) 본문 */
  body: `Bong투어는 여행 상품을 직접 판매하거나 결제를 대행하는 온라인 쇼핑몰이 아닙니다. 화면에 보이는 상품·요금·일정·조건은 각 공급사(여행사)가 제공·운영하는 정보를 바탕으로 안내드리는 것이며, 최종 예약 성립·계약·결제·변경·취소는 공급사 기준과 확인 절차에 따릅니다.`,
  /** 짧은 요약 (compact, 카드 하단 등) */
  compactBody: `상품·요금·일정은 공급사(여행사) 기준이며, 최종 예약·계약은 공급사 확인 후 진행됩니다.`,
  /** 로고·브랜드 표기 옆 보조 설명 */
  brandMarkHelper:
    '표기된 여행사명·로고는 해당 공급사 상품 안내를 위한 표시이며, Bong투어는 상담·접수 창구 역할을 합니다.',
} as const

/** 예약·접수에 대한 오인 방지 (상담/접수 중심) */
export const BOOKING_DISCLAIMER_COPY = {
  title: '접수·상담에 관해',
  body: `Bong투어를 통한 신청·문의는 상담·접수 단계입니다. 담당자 확인 후 연락드리며, 예약이 확정되었다는 의미가 아닙니다. 잔여석·요금 변동·비자·항공·보험 등 세부 조건은 상담 시 안내·공급사 확인이 필요합니다.`,
  compactBody: `신청·문의는 접수 단계이며, 확정 안내 전까지 예약이 확정된 것은 아닙니다.`,
} as const

/** 짧은 안내 한 줄·두 줄 (메인·상세·폼·완료 하단 등) */
export const SHORT_NOTICES = {
  mainHero:
    '상담과 접수는 Bong투어에서, 최종 조건 확인은 공급사(여행사) 기준으로 진행됩니다.',
  productDetail:
    '요금·일정은 안내 시점 기준이며, 신청 후 담당자 확인 및 공급사 조건에 따라 달라질 수 있습니다.',
  inquiryForm:
    '제출하신 내용은 접수·상담용이며, 확정 안내 전까지 계약·예약 확정으로 보지 않습니다.',
  successFooter:
    '추가 서류나 일정 조율이 필요하면 연락 시 안내드리겠습니다.',
} as const

/** 문의 완료 — 기본(유형 미지정 시) */
export const INQUIRY_SUCCESS_DEFAULT = {
  headline: '문의가 접수되었습니다',
  lines: [
    '담당자가 내용을 확인한 뒤 연락드리겠습니다.',
    '접수만으로 예약·계약이 확정된 것은 아닙니다.',
    '공급사(여행사) 및 운영 조건에 따라 안내가 달라질 수 있습니다.',
  ],
} as const

export type InquirySuccessKind = 'travel' | 'institution' | 'training' | 'bus'

/** 문의 완료 — 유형별(여행상담·기관·연수·버스 등) */
export const INQUIRY_SUCCESS_BY_TYPE: Record<
  InquirySuccessKind,
  { headline: string; lines: string[] }
> = {
  travel: {
    headline: '여행 상담 문의가 접수되었습니다',
    lines: [
      '일정·인원·요금은 상담을 통해 조율하며, 최종 조건은 공급사(여행사) 확인 후 확정됩니다.',
      '잔여석·요금 변동이 있을 수 있으니, 연락 시 함께 안내드리겠습니다.',
    ],
  },
  institution: {
    headline: '기관·단체 문의가 접수되었습니다',
    lines: [
      '인원·일정·견적은 내부 검토 후 별도로 연락드립니다.',
      '확정 견적·계약 전까지는 확약으로 보지 않습니다.',
    ],
  },
  training: {
    headline: '해외 연수·단체 견적 문의가 접수되었습니다',
    lines: [
      '프로그램·비용·일정은 검토 후 담당자가 연락드립니다.',
      '발급 서류·현지 조건 등은 단계별로 안내드릴 수 있습니다.',
    ],
  },
  bus: {
    headline: '버스·차량 견적 문의가 접수되었습니다',
    lines: [
      '노선·시간·차량 규격에 따라 견적이 달라질 수 있습니다.',
      '배차·확정은 상담 후 공지드리며, 확정 전까지 예약 확정으로 보지 않습니다.',
    ],
  },
}

/** 고지 블록용 — 섹션 단위로 조합 가능 */
export const DISCLOSURE_SECTIONS = {
  supplierRelation: {
    heading: SUPPLIER_RELATION_COPY.title,
    text: SUPPLIER_RELATION_COPY.body,
    textCompact: SUPPLIER_RELATION_COPY.compactBody,
  },
  bookingClarity: {
    heading: BOOKING_DISCLAIMER_COPY.title,
    text: BOOKING_DISCLAIMER_COPY.body,
    textCompact: BOOKING_DISCLAIMER_COPY.compactBody,
  },
} as const
