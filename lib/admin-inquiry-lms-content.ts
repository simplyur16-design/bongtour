/**
 * 문의 관리자용 LMS(Solapi) 본문·유형 라벨·실발송 테스트 고정값.
 * 본문은 `CustomerInquiry.payloadJson` + 상위 컬럼만 사용한다(클라이언트 번들 금지).
 */

import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'
import { getSiteOrigin } from '@/lib/site-metadata'

/** Solapi LMS UTF-8 바이트 상한 (운영 가이드) */
export const ADMIN_INQUIRY_LMS_MAX_BYTES = 2000

export type AdminInquiryLmsBodyInput = {
  inquiryId: string
  inquiryType: string
  productLabel: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  preferredContactChannel: string | null
  message: string | null
  /** `CustomerInquiry.payloadJson` — 폼별 `buildPayloadJson()` 결과가 직렬화되어 저장됨 */
  payloadJson: string | null
  /** 봉투어 상품 링크 라인 — 있을 때만 LMS에 포함 */
  productId?: string | null
  /** 공급사 원문 링크 라인 — trim 후 있을 때만 포함 */
  snapshotOriginUrl?: string | null
}

export const ADMIN_INQUIRY_LMS_HEADER = '[봉투어 신규문의]'

export const ADMIN_INQUIRY_LMS_TYPE_LABELS: Record<string, string> = {
  travel_consult: '여행상담',
  institution_request: '기관/단체',
  overseas_training_quote: '국외연수 견적',
  bus_quote: '전세버스 견적',
}

function pickInt(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key]
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) return v
  return undefined
}

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

function truncateUtf8BytesApprox(s: string, maxBytes: number): string {
  if (utf8ByteLength(s) <= maxBytes) return s
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const sub = s.slice(0, mid)
    if (utf8ByteLength(sub) <= maxBytes) lo = mid
    else hi = mid - 1
  }
  return `${s.slice(0, lo)}…`
}

/** `lib/admin-inquiry.ts` inquiryTypeDisplayLabel 과 동일 분기(문자열). */
export function adminInquiryLmsTypeLabel(inquiryType: string, payload: Record<string, unknown>): string {
  if (inquiryType === 'travel_consult' && payload.quoteKind === 'private_custom') {
    return '우리견적 문의'
  }
  return ADMIN_INQUIRY_LMS_TYPE_LABELS[inquiryType] ?? '일반문의'
}

/**
 * 폼·payloadJson 실제 키 기준 인원 한 줄.
 * - travel_consult + quoteKind private_custom: `headcount` → `총 n명`
 * - travel_consult 그 외: `성인 n명 / 아동 n명 / 유아 n명` (미전달 구간은 0으로 표시, 전부 없으면 '-')
 * - institution_request: `estimatedHeadcount`
 * - bus_quote: `estimatedHeadcount`
 * - overseas_training_quote: `headcount`
 */
export function adminInquiryLmsHeadcountLine(inquiryType: string, payload: Record<string, unknown>): string {
  const qk = typeof payload.quoteKind === 'string' ? payload.quoteKind : ''

  if (inquiryType === 'travel_consult') {
    if (qk === 'private_custom') {
      const t = pickInt(payload, 'headcount')
      return t !== undefined && t > 0 ? `총 ${t}명` : '-'
    }
    const adult = pickInt(payload, 'adultCount')
    const child = pickInt(payload, 'childCount')
    const infant = pickInt(payload, 'infantCount')
    if (adult === undefined && child === undefined && infant === undefined) return '-'
    const a = adult ?? 0
    const c = child ?? 0
    const i = infant ?? 0
    return `성인 ${a}명 / 아동 ${c}명 / 유아 ${i}명`
  }

  if (inquiryType === 'institution_request') {
    const h = pickInt(payload, 'estimatedHeadcount')
    return h !== undefined && h > 0 ? `총 ${h}명` : '-'
  }

  if (inquiryType === 'bus_quote') {
    const h = pickInt(payload, 'estimatedHeadcount')
    return h !== undefined && h > 0 ? `총 ${h}명` : '-'
  }

  if (inquiryType === 'overseas_training_quote') {
    const h = pickInt(payload, 'headcount')
    return h !== undefined && h > 0 ? `총 ${h}명` : '-'
  }

  return '-'
}

/** `components/inquiry/*Form.tsx` 의 `buildPayloadJson` 키만 사용, 최대 2줄. */
export function adminInquiryLmsPayloadContextLines(inquiryType: string, payload: Record<string, unknown>): string[] {
  const lines: string[] = []
  const qk = typeof payload.quoteKind === 'string' ? payload.quoteKind : ''

  const push = (label: string, raw: unknown, maxLen: number) => {
    if (typeof raw !== 'string') return
    const t = raw.trim()
    if (!t) return
    lines.push(`${label}: ${truncateForAdminInquiryLms(t, maxLen)}`)
  }

  if (inquiryType === 'travel_consult' && qk === 'private_custom') {
    push('여행지', payload.destinationSummary, 72)
    const dep =
      typeof payload.preferredDepartureDate === 'string' ? payload.preferredDepartureDate.trim() : ''
    const mo =
      typeof payload.preferredDepartureMonth === 'string' ? payload.preferredDepartureMonth.trim() : ''
    const sched = dep || mo
    if (sched) lines.push(`출발희망: ${truncateForAdminInquiryLms(sched, 40)}`)
    return lines.slice(0, 2)
  }

  if (inquiryType === 'travel_consult') {
    push('희망월', payload.targetYearMonth, 24)
    push('희망지역', payload.preferredRegion, 72)
    return lines.slice(0, 2)
  }

  if (inquiryType === 'institution_request') {
    if (payload.interpreterNeeded === true) {
      lines.push('통역·코디: 희망')
    }
    if (lines.length < 2) {
      push('기관명', payload.organizationName, 72)
    }
    if (lines.length < 2) {
      push('희망국가도시', payload.preferredCountryCity, 72)
    }
    return lines.slice(0, 2)
  }

  if (inquiryType === 'overseas_training_quote') {
    push('서비스범위', payload.serviceScope, 72)
    push('연수지', payload.destinationSummary, 72)
    return lines.slice(0, 2)
  }

  if (inquiryType === 'bus_quote') {
    const dep = typeof payload.departurePlace === 'string' ? payload.departurePlace.trim() : ''
    const arr = typeof payload.arrivalPlace === 'string' ? payload.arrivalPlace.trim() : ''
    if (dep || arr) {
      lines.push(`노선: ${truncateForAdminInquiryLms(`${dep || '?'}→${arr || '?'}`, 80)}`)
    }
    const ud = typeof payload.useDate === 'string' ? payload.useDate.trim() : ''
    const ym = typeof payload.targetYearMonth === 'string' ? payload.targetYearMonth.trim() : ''
    const when = ud || ym
    if (when) lines.push(`이용희망: ${truncateForAdminInquiryLms(when, 40)}`)
    return lines.slice(0, 2)
  }

  return []
}

export function truncateForAdminInquiryLms(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function summarizeAdminInquiryLmsMessageOneLine(message: string | null | undefined): string {
  if (!message?.trim()) return '-'
  const oneLine = message.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  const max = 120
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

function summarizeMessageWithMax(message: string | null | undefined, maxChars: number): string {
  if (!message?.trim()) return '-'
  const oneLine = message.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxChars) return oneLine
  return `${oneLine.slice(0, Math.max(0, maxChars - 1))}…`
}

type CoreBuildOpts = {
  productLabelMax: number
  messageMaxChars: number
  includeExtras: boolean
}

function buildAdminInquiryLmsCore(p: AdminInquiryLmsBodyInput, opts: CoreBuildOpts): string {
  const payload = parseInquiryPayloadJson(p.payloadJson)
  const typeLabel = adminInquiryLmsTypeLabel(p.inquiryType, payload)
  const emailLine = p.applicantEmail?.trim() ? p.applicantEmail.trim() : '-'
  const channelLine = p.preferredContactChannel?.trim() ? p.preferredContactChannel.trim() : '-'
  const messageLine = summarizeMessageWithMax(p.message, opts.messageMaxChars)
  const headLine = adminInquiryLmsHeadcountLine(p.inquiryType, payload)
  const extras = opts.includeExtras ? adminInquiryLmsPayloadContextLines(p.inquiryType, payload) : []

  const core = [
    ADMIN_INQUIRY_LMS_HEADER,
    `유형: ${typeLabel}`,
    `상품: ${truncateForAdminInquiryLms(p.productLabel, opts.productLabelMax)}`,
    `인원: ${headLine}`,
    ...extras,
    `고객: ${truncateForAdminInquiryLms(p.applicantName, 80)}`,
    `연락처: ${p.applicantPhone.trim()}`,
    `이메일: ${emailLine}`,
    `희망채널: ${channelLine}`,
    `문의내용: ${messageLine}`,
    `접수ID: ${p.inquiryId}`,
  ]
  return core.join('\n')
}

function buildAdminInquiryLmsUrlFooter(p: AdminInquiryLmsBodyInput, origin: string): string {
  const lines: string[] = ['───']
  const pid = p.productId?.trim()
  if (pid) {
    lines.push(`봉투어 상품: ${origin}/products/${pid}`)
  }
  const ou = p.snapshotOriginUrl?.trim()
  if (ou) {
    const disp = utf8ByteLength(ou) > 400 ? truncateUtf8BytesApprox(ou, 400) : ou
    lines.push(`공급사 원문: ${disp}`)
  }
  lines.push(`어드민 처리: ${origin}/admin/inquiries/${p.inquiryId}`)
  return lines.join('\n')
}

/** 관리자 LMS 본문 (줄바꿈 구분). URL 푸터는 항상 포함하며, 본문은 2000byte 이내로 축약. */
export function buildAdminInquiryLmsBody(p: AdminInquiryLmsBodyInput): string {
  const origin = getSiteOrigin()
  const footer = buildAdminInquiryLmsUrlFooter(p, origin)
  const maxCoreBytes = Math.max(120, ADMIN_INQUIRY_LMS_MAX_BYTES - utf8ByteLength(footer) - 1)

  const attempts: CoreBuildOpts[] = [
    { productLabelMax: 200, messageMaxChars: 120, includeExtras: true },
    { productLabelMax: 120, messageMaxChars: 80, includeExtras: true },
    { productLabelMax: 80, messageMaxChars: 60, includeExtras: false },
    { productLabelMax: 50, messageMaxChars: 40, includeExtras: false },
    { productLabelMax: 36, messageMaxChars: 24, includeExtras: false },
  ]

  for (const o of attempts) {
    const core = buildAdminInquiryLmsCore(p, o)
    if (utf8ByteLength(core) <= maxCoreBytes) {
      return `${core}\n${footer}`
    }
  }

  let core = buildAdminInquiryLmsCore(p, attempts[attempts.length - 1])
  if (utf8ByteLength(core) > maxCoreBytes) {
    core = truncateUtf8BytesApprox(core, maxCoreBytes)
  }
  return `${core}\n${footer}`
}

/** `POST /api/admin/test-inquiry-lms` 실발송 검증용 고정 입력. */
export const ADMIN_INQUIRY_LMS_TEST_FIXTURE = {
  inquiryType: 'travel_consult',
  productLabel: '오사카 3박4일 테스트',
  applicantName: '테스트홍길동',
  applicantPhone: '010-1111-2222',
  applicantEmail: 'test@test.com',
  preferredContactChannel: 'both',
  message: '관리자용 LMS 실발송 테스트',
  inquiryId: 'test-inquiry-lms',
  productId: 'cm_test_product_snapshot',
  snapshotOriginUrl: 'https://supplier.example.com/pkg/TEST-001',
  payloadJson: JSON.stringify({
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    targetYearMonth: '2026-05',
    preferredRegion: '간사이',
  }),
} satisfies AdminInquiryLmsBodyInput
