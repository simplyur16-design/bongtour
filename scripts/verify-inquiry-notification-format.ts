/**
 * 운영자 알림 포맷 + 회귀 assertion (SMTP 불필요).
 * npx tsx scripts/verify-inquiry-notification-format.ts
 */
import { formatInquiryTypeForAdminEmailLine, INQUIRY_MAIL_PREFIX } from '@/lib/inquiry-routing-metadata'
import {
  buildInquiryEmailSubject,
  buildInquiryEmailSummaryBlock,
  resolveInquiryAlertPrefix,
  type InquiryNotifyInput,
} from '@/lib/inquiry-notification-format'
import { buildInquiryEmailAppendixLines } from '@/lib/inquiry-email'

process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('[ASSERT FAIL]', msg)
    process.exit(1)
  }
}

function appendixHead(lines: string[]): string {
  return lines.find((l) => l.startsWith('[')) ?? ''
}

function appendixBlob(lines: string[]): string {
  return lines.join('\n')
}

/** 타입별 appendix는 `[섹션제목]` 형태 헤더가 최대 1개 */
function assertAppendixAtMostOneSectionHeader(label: string, appendix: string[]): void {
  const headers = appendix.map((l) => l.trim()).filter((l) => /^\[[^\]]+\]$/.test(l))
  assert(headers.length <= 1, `${label}: appendix 섹션 헤더는 1개 이하여야 함 (${headers.join(' | ')})`)
}

function sampleTravelGeneral(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_tr_gen',
    inquiryType: 'travel_consult',
    applicantName: '일반',
    applicantPhone: '010-0000-0001',
    applicantEmail: null,
    message: '일반 상담',
    sourcePagePath: '/inquiry?type=travel',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({ adultCount: 2, childCount: 0, infantCount: 0 }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

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
      selectedPriceKrw: '1,990,000원',
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

function sampleTravelAir(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_tr_air',
    inquiryType: 'travel_consult',
    applicantName: '항공',
    applicantPhone: '010-0000-0002',
    applicantEmail: 'air@x.com',
    message: '항공 상담',
    sourcePagePath: '/inquiry?type=travel&source=/air-ticketing',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({ preferredRegion: '도쿄', targetYearMonth: '2026-05' }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

function sampleTravelPrivateQuote(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_tr_pq',
    inquiryType: 'travel_consult',
    applicantName: '우리',
    applicantPhone: '010-0000-0003',
    applicantEmail: 'pq@x.com',
    message: '12345678901우리견적 문의 본문입니다.',
    sourcePagePath: '/quote/private',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      quoteKind: 'private_custom',
      destinationSummary: '스위스',
      headcount: 4,
      preferredDepartureMonth: '2026-07',
    }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

function sampleTraining(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_train',
    inquiryType: 'overseas_training_quote',
    applicantName: '연수',
    applicantPhone: '010-0000-0004',
    applicantEmail: 't@x.com',
    message: '국외연수 문의 본문입니다.',
    sourcePagePath: '/inquiry?type=training',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      serviceScope: '기관방문+통역',
      organizationName: 'OO대',
      destinationSummary: '독일',
      preferredDepartureMonth: '2026-09',
      headcount: 12,
      trainingPurpose: '벤치마킹',
    }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
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

function sampleInstitutionPlain(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_inst_plain',
    inquiryType: 'institution_request',
    applicantName: '박기관',
    applicantPhone: '010-0000-0000',
    applicantEmail: null,
    message: '기관 방문 문의',
    sourcePagePath: '/inquiry?type=institution',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: JSON.stringify({
      interpreterNeeded: false,
      organizationName: 'OO시청',
      preferredCountryCity: '도쿄',
    }),
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

/** 비정상 타입 — `[일반 문의]`로 뭉개지 않고 FALLBACK prefix */
function sampleUnknownType(): InquiryNotifyInput {
  return {
    inquiryId: 'inq_bad',
    inquiryType: 'legacy_unknown_type',
    applicantName: 'X',
    applicantPhone: '010-9999-9999',
    applicantEmail: null,
    message: '-',
    sourcePagePath: '/x',
    createdAtIso: '2026-04-15T12:00:00.000Z',
    payloadJson: null,
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  }
}

function runCase(
  label: string,
  input: InquiryNotifyInput,
  check: (ctx: {
    prefix: string
    subject: string
    appendix: string[]
    adminLabel: string
  }) => void
): void {
  const prefix = resolveInquiryAlertPrefix(input)
  const subject = buildInquiryEmailSubject(input, prefix)
  const block = buildInquiryEmailSummaryBlock(input, prefix)
  const appendix = buildInquiryEmailAppendixLines(input)
  const adminLabel = formatInquiryTypeForAdminEmailLine(input.inquiryType, input.payloadJson)
  console.log(`\n=== ${label} ===`)
  console.log(JSON.stringify({ inquiryType: input.inquiryType, adminLabel, prefix, subject, appendixHead: appendixHead(appendix) }, null, 0))
  console.log('[SUMMARY preview]\n' + block.split('\n').slice(0, 8).join('\n'))
  if (appendix.length) console.log('[APPENDIX]\n' + appendix.join('\n'))
  check({ prefix, subject, appendix, adminLabel })
}

runCase('travel 일반', sampleTravelGeneral(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.TRAVEL_GENERAL, `travel 일반 prefix`)
  assert(appendix.length === 0, 'travel 일반 appendix 비어야 함')
})

runCase('travel 상품', sampleTravelProduct(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.TRAVEL_PRODUCT, 'travel 상품 prefix')
  assert(appendixHead(appendix) === '[상품 문의 정보]', 'travel 상품 appendix 헤더')
  const blob = appendixBlob(appendix)
  assert(!blob.includes('[기관/단체 문의 보조]'), '상품에 기관 appendix 금지')
  assert(!blob.includes('[국외연수 폼 필드 보조]'), '상품에 국외연수 appendix 금지')
  assert(!blob.includes('[전세버스 문의 보조]'), '상품에 버스 appendix 금지')
})

runCase('travel 항공', sampleTravelAir(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.FLIGHT, 'travel 항공 prefix')
  assert(appendix.length === 0, 'travel 항공 appendix 없음')
})

runCase('travel 우리견적', sampleTravelPrivateQuote(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.PRIVATE_QUOTE, '우리견적 prefix')
  assert(appendix.length === 0, '우리견적 appendix 없음')
})

runCase('institution 기관', sampleInstitutionPlain(), ({ prefix, appendix }) => {
  assert(prefix !== INQUIRY_MAIL_PREFIX.TRAVEL_GENERAL, '기관이 일반 문의 prefix면 안 됨')
  assert(prefix === INQUIRY_MAIL_PREFIX.INSTITUTION, '기관 prefix')
  assert(appendixHead(appendix) === '[기관/단체 문의 보조]', '기관 appendix')
  assert(!appendixBlob(appendix).includes('[상품 문의 정보]'), '기관에 상품 appendix 금지')
  assert(!appendixBlob(appendix).includes('[국외연수 폼 필드 보조]'), '기관에 연수 appendix 금지')
})

runCase('institution 통역', sampleInterpreter(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.INTERPRETER, '통역 prefix')
  assert(prefix !== INQUIRY_MAIL_PREFIX.TRAVEL_GENERAL, '통역이 일반 문의 prefix면 안 됨')
  assert(prefix !== '[일반 문의]', '통역이 [일반 문의] 문자열이면 안 됨')
  assert(appendixHead(appendix) === '[기관/단체 문의 보조]', '통역도 기관 appendix 한 종류')
})

runCase('training', sampleTraining(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.TRAINING, 'training prefix')
  assert(appendixHead(appendix) === '[국외연수 폼 필드 보조]', 'training appendix')
  assert(!appendixBlob(appendix).includes('[기관/단체 문의 보조]'), 'training에 기관 appendix 금지')
  assert(!appendixBlob(appendix).includes('[상품 문의 정보]'), 'training에 상품 appendix 금지')
})

runCase('bus', sampleBus(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.BUS, 'bus prefix')
  assert(appendixHead(appendix) === '[전세버스 문의 보조]', 'bus appendix')
  assert(!appendixBlob(appendix).includes('[상품 문의 정보]'), 'bus에 상품 appendix 금지')
  assert(!appendixBlob(appendix).includes('[국외연수 폼 필드 보조]'), 'bus에 연수 appendix 금지')
  assert(!appendixBlob(appendix).includes('[기관/단체 문의 보조]'), 'bus에 기관 appendix 금지')
})

runCase('unknown inquiryType (비운영)', sampleUnknownType(), ({ prefix, appendix }) => {
  assert(prefix === INQUIRY_MAIL_PREFIX.FALLBACK, '비정상 타입은 FALLBACK')
  assert(prefix !== INQUIRY_MAIL_PREFIX.TRAVEL_GENERAL, '비정상을 일반 문의로 뭉개면 안 됨')
  assert(prefix === '[문의 접수]', 'unknown은 [문의 접수] fallback')
  assert(appendix.length === 0, 'unknown appendix 없음')
})

const ALL_VERIFY_SAMPLES: Array<{ label: string; input: InquiryNotifyInput }> = [
  { label: 'travel 일반', input: sampleTravelGeneral() },
  { label: 'travel 상품', input: sampleTravelProduct() },
  { label: 'travel 항공', input: sampleTravelAir() },
  { label: 'travel 우리견적', input: sampleTravelPrivateQuote() },
  { label: 'institution 기관', input: sampleInstitutionPlain() },
  { label: 'institution 통역', input: sampleInterpreter() },
  { label: 'training', input: sampleTraining() },
  { label: 'bus', input: sampleBus() },
  { label: 'unknown', input: sampleUnknownType() },
]

for (const { label, input } of ALL_VERIFY_SAMPLES) {
  const prefix = resolveInquiryAlertPrefix(input)
  const subject = buildInquiryEmailSubject(input, prefix)
  assert(!subject.includes('[['), `${label}: subject에 [[ 비정상 중복 없음`)
  assertAppendixAtMostOneSectionHeader(label, buildInquiryEmailAppendixLines(input))
}

console.log('\n[OK] verify-inquiry-notification-format: all assertions passed')
