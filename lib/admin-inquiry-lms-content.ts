/**
 * 문의 관리자용 LMS(Solapi) 본문·유형 라벨·실발송 테스트 고정값.
 * 본문은 `CustomerInquiry.payloadJson` + 상위 컬럼만 사용한다(클라이언트 번들 금지).
 */

import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

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

function truncateForAdminInquiryLms(s: string, max: number): string {
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

/** 관리자 LMS 본문 (줄바꿈 구분 블록). */
export function buildAdminInquiryLmsBody(p: AdminInquiryLmsBodyInput): string {
  const payload = parseInquiryPayloadJson(p.payloadJson)
  const typeLabel = adminInquiryLmsTypeLabel(p.inquiryType, payload)
  const emailLine = p.applicantEmail?.trim() ? p.applicantEmail.trim() : '-'
  const channelLine = p.preferredContactChannel?.trim() ? p.preferredContactChannel.trim() : '-'
  const messageLine = summarizeAdminInquiryLmsMessageOneLine(p.message)
  const headLine = adminInquiryLmsHeadcountLine(p.inquiryType, payload)
  const extras = adminInquiryLmsPayloadContextLines(p.inquiryType, payload)

  const core = [
    ADMIN_INQUIRY_LMS_HEADER,
    `유형: ${typeLabel}`,
    `상품: ${truncateForAdminInquiryLms(p.productLabel, 200)}`,
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
  payloadJson: JSON.stringify({
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    targetYearMonth: '2026-05',
    preferredRegion: '간사이',
  }),
} satisfies AdminInquiryLmsBodyInput
