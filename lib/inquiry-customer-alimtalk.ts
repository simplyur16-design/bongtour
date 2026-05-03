/**
 * 문의 접수 고객 알림톡 — 솔라피 카카오 템플릿 ID(env)·변수 매핑 (서버 전용).
 * 템플릿 본문은 솔라피 콘솔 등록본 기준, 변수 키는 콘솔의 #{이름} 과 동일한 `이름` 문자열을 사용한다.
 */

import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

/** 알림톡 변수 세트 분기용(문의 유형 + 우리견적 여부). */
export type InquiryCustomerAlimtalkKind =
  | 'private_quote'
  | 'travel_consult'
  | 'institution_request'
  | 'overseas_training_quote'
  | 'bus_quote'

export type InquiryCustomerAlimtalkContext = {
  inquiryId: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  payloadJson: string | null
  /**
   * 관리자 LMS·고객 LMS 폴백 등 — `productMeta?.title || snapshotProductTitle || snapshotCardLabel || '상담문의'`
   * (알림톡 여행상담 템플릿의 #{상품명}과는 별도: `travelConsultProductTitle` 참고)
   */
  productLabel: string
  /** 여행상담 알림톡 #{상품명} — `productMeta?.title || snapshotProductTitle || '상담문의'` (snapshotCardLabel 제외) */
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

const TEMPLATE_ENV_KEYS: Record<InquiryCustomerAlimtalkKind, string> = {
  private_quote: 'SOLAPI_TPL_PRIVATE_QUOTE',
  travel_consult: 'SOLAPI_TPL_TRAVEL_CONSULT',
  institution_request: 'SOLAPI_TPL_INSTITUTION',
  overseas_training_quote: 'SOLAPI_TPL_TRAINING',
  bus_quote: 'SOLAPI_TPL_BUS',
}

/**
 * `inquiryType` + `payloadJson` 기준 알림톡 변수 분기.
 */
export function resolveInquiryCustomerAlimtalkKind(
  inquiryType: string,
  payload: Record<string, unknown>
): InquiryCustomerAlimtalkKind | null {
  if (inquiryType === 'travel_consult' && payload.quoteKind === 'private_custom') {
    return 'private_quote'
  }
  if (inquiryType === 'travel_consult') return 'travel_consult'
  if (inquiryType === 'institution_request') return 'institution_request'
  if (inquiryType === 'overseas_training_quote') return 'overseas_training_quote'
  if (inquiryType === 'bus_quote') return 'bus_quote'
  return null
}

function readTemplateIdForKind(kind: InquiryCustomerAlimtalkKind): string | null {
  const envKey = TEMPLATE_ENV_KEYS[kind]
  const raw = process.env[envKey]?.trim()
  if (!raw) {
    console.error(
      '[inquiry-customer-alimtalk] missing_solapi_template_env',
      JSON.stringify({ envKey, kind })
    )
    return null
  }
  return raw
}

/**
 * 고객 알림톡 템플릿 ID — env `SOLAPI_TPL_*` 값. 누락 시 null.
 */
export function selectInquiryCustomerAlimtalkTemplateId(
  inquiryType: string,
  payload: Record<string, unknown>
): string | null {
  const kind = resolveInquiryCustomerAlimtalkKind(inquiryType, payload)
  if (!kind) return null
  return readTemplateIdForKind(kind)
}

/** `kakaoOptions.variables` — 값은 모두 문자열. */
export function buildInquiryCustomerAlimtalkVariables(
  kind: InquiryCustomerAlimtalkKind,
  ctx: InquiryCustomerAlimtalkContext
): Record<string, string> {
  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const name = ctx.applicantName.trim() || '-'

  switch (kind) {
    case 'travel_consult': {
      const preview = ctx.snapshotCardLabel?.trim() || '-'
      const title = ctx.travelConsultProductTitle.trim() || '상담문의'
      return {
        고객명: name,
        상품명: title,
        미리보기: preview,
      }
    }
    case 'private_quote': {
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
    case 'institution_request': {
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
    case 'overseas_training_quote': {
      const h = pickInt(payload, 'headcount')
      return {
        고객명: name,
        연수지: strOrDash(payload.destinationSummary),
        인원수: h !== undefined && h > 0 ? String(h) : '-',
        서비스범위: strOrDash(payload.serviceScope),
      }
    }
    case 'bus_quote': {
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
  }
}
