/**
 * 운영자 알림 포맷 스냅샷(서버·SMTP 불필요).
 * npx tsx scripts/verify-inquiry-notification-format.ts
 */
import {
  buildInquiryEmailSubject,
  buildInquiryEmailSummaryBlock,
  resolveInquiryAlertPrefix,
  type InquiryNotifyInput,
} from '@/lib/inquiry-notification-format'

process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'

function sampleTravelProduct(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_travel_001',
    inquiryType: 'travel_consult',
    applicantName: '홍길동',
    applicantPhone: '010-1111-2222',
    applicantEmail: 'a@b.com',
    message: '상담 요청합니다.',
    sourcePagePath: '/travel/product?x=1',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      targetYearMonth: '2026-04',
    }),
    productId: 'prod_cuid_abc',
    snapshotProductTitle: '[연길직항] 연길 백두산 4일',
    snapshotCardLabel: null,
    product: {
      title: '[연길직항] 연길 백두산 북파·서파 4일',
      originCode: 'MD12345',
      originSource: 'modetour',
    },
  }
}

function sampleBus(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_bus_002',
    inquiryType: 'bus_quote',
    applicantName: '김버스',
    applicantPhone: '010-3333-4444',
    applicantEmail: null,
    message: '전세 문의',
    sourcePagePath: '/inquiry?type=bus',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      consultType: 'CHARTER_BUS',
      quoteKind: 'charter_bus_consult',
      usageType: '관광',
      useDate: '2026-05-01',
      departurePlace: '서울',
      arrivalPlace: '부산',
      estimatedHeadcount: 30,
    }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

function sampleInterpreter(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_interp_003',
    inquiryType: 'institution_request',
    applicantName: '이통역',
    applicantPhone: '010-5555-6666',
    applicantEmail: 'c@d.com',
    message: '통역 필요합니다.',
    sourcePagePath: '/inquiry?type=institution',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      interpreterNeeded: true,
      preferredCountryCity: '도쿄',
      organizationName: 'OO학교',
      estimatedHeadcount: 8,
    }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

function dump(label: string, input: InquiryNotifyInput): void {
  const prefix = resolveInquiryAlertPrefix(input)
  const subj = buildInquiryEmailSubject(input, prefix)
  const block = buildInquiryEmailSummaryBlock(input, prefix)
  console.log(`\n=== ${label} (prefix=${prefix}) ===`)
  console.log('[EMAIL SUBJECT]', subj)
  console.log('[EMAIL SUMMARY TOP]\n' + block.split('\n').slice(0, 12).join('\n'))
}

dump('여행상품 문의', sampleTravelProduct())
dump('전세버스 문의', sampleBus())
dump('통역 문의', sampleInterpreter())
