/**
 * 문의 접수 고객 알림톡 — 솔라피 카카오 템플릿 ID·변수 매핑 (서버 전용).
 * 템플릿 본문은 솔라피 콘솔 등록본 기준, 변수 키는 콘솔의 #{이름} 과 동일한 `이름` 문자열을 사용한다.
 */

import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

/** 솔라피에 등록한 알림톡 템플릿 코드(이름과 동일하게 맞출 것). */
export const INQUIRY_ALIMTALK_TPL_TRAVEL_CONSULT = '여행상담접수완료'
export const INQUIRY_ALIMTALK_TPL_PRIVATE_QUOTE = '우리견적접수완료'
export const INQUIRY_ALIMTALK_TPL_INSTITUTION = '기관문의접수완료'
export const INQUIRY_ALIMTALK_TPL_TRAINING = '국외연수문의접수완료'
export const INQUIRY_ALIMTALK_TPL_BUS = '전세버스문의접수완료'

export type InquiryCustomerAlimtalkContext = {
  inquiryId: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  payloadJson: string | null
  /**
   * 관리자 LMS·고객 LMS 폴백 등 — `productMeta?.title || snapshotProductTitle || snapshotCardLabel || '상담문의'`
   * (알림톡 `여행상담접수완료`의 #{상품명}과는 별도: `travelConsultProductTitle` 참고)
   */
  productLabel: string
  /** `여행상담접수완료` #{상품명} — `productMeta?.title || snapshotProductTitle || '상담문의'` (snapshotCardLabel 제외) */
  travelConsultProductTitle: string
  snapshotCardLabel: string | null
}

function pickInt(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key]
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) return v
  return undefined
}

function strOrDash(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim()) return v.trim()
  return '-'
}

/**
 * 고객 알림톡 템플릿 선택 (주력 5종). `상담문의접수완료` 등 공통 템플릿은 사용하지 않는다.
 */
export function selectInquiryCustomerAlimtalkTemplateId(
  inquiryType: string,
  payload: Record<string, unknown>
): string | null {
  if (inquiryType === 'travel_consult' && payload.quoteKind === 'private_custom') {
    return INQUIRY_ALIMTALK_TPL_PRIVATE_QUOTE
  }
  if (inquiryType === 'travel_consult') return INQUIRY_ALIMTALK_TPL_TRAVEL_CONSULT
  if (inquiryType === 'institution_request') return INQUIRY_ALIMTALK_TPL_INSTITUTION
  if (inquiryType === 'overseas_training_quote') return INQUIRY_ALIMTALK_TPL_TRAINING
  if (inquiryType === 'bus_quote') return INQUIRY_ALIMTALK_TPL_BUS
  return null
}

/** `kakaoOptions.variables` — 값은 모두 문자열. */
export function buildInquiryCustomerAlimtalkVariables(
  templateId: string,
  ctx: InquiryCustomerAlimtalkContext
): Record<string, string> {
  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const name = ctx.applicantName.trim() || '-'

  if (templateId === INQUIRY_ALIMTALK_TPL_TRAVEL_CONSULT) {
    const preview = ctx.snapshotCardLabel?.trim() || '-'
    const title = ctx.travelConsultProductTitle.trim() || '상담문의'
    return {
      고객명: name,
      상품명: title,
      미리보기: preview,
    }
  }

  if (templateId === INQUIRY_ALIMTALK_TPL_PRIVATE_QUOTE) {
    const dep =
      typeof payload.preferredDepartureDate === 'string' ? payload.preferredDepartureDate.trim() : ''
    const mo =
      typeof payload.preferredDepartureMonth === 'string' ? payload.preferredDepartureMonth.trim() : ''
    const head = pickInt(payload, 'headcount')
    return {
      고객명: name,
      여행지: strOrDash(payload.destinationSummary),
      인원수: head !== undefined && head > 0 ? String(head) : '-',
      출발희망: dep || mo || '-',
    }
  }

  if (templateId === INQUIRY_ALIMTALK_TPL_INSTITUTION) {
    const h = pickInt(payload, 'estimatedHeadcount')
    const interp = payload.interpreterNeeded === true ? '희망' : '미정'
    return {
      고객명: name,
      기관명: strOrDash(payload.organizationName),
      희망국가도시: strOrDash(payload.preferredCountryCity),
      인원수: h !== undefined && h > 0 ? String(h) : '-',
      통역희망: interp,
    }
  }

  if (templateId === INQUIRY_ALIMTALK_TPL_TRAINING) {
    const h = pickInt(payload, 'headcount')
    return {
      고객명: name,
      연수지: strOrDash(payload.destinationSummary),
      인원수: h !== undefined && h > 0 ? String(h) : '-',
      서비스범위: strOrDash(payload.serviceScope),
    }
  }

  if (templateId === INQUIRY_ALIMTALK_TPL_BUS) {
    const h = pickInt(payload, 'estimatedHeadcount')
    const ud = typeof payload.useDate === 'string' ? payload.useDate.trim() : ''
    const ym = typeof payload.targetYearMonth === 'string' ? payload.targetYearMonth.trim() : ''
    return {
      고객명: name,
      이용일: ud || ym || '-',
      출발지: strOrDash(payload.departurePlace),
      도착지: strOrDash(payload.arrivalPlace),
      인원수: h !== undefined && h > 0 ? String(h) : '-',
    }
  }

  return { 고객명: name }
}
