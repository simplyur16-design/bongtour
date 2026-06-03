/**
 * 문의 접수 고객 알림톡 — 솔라피 등록 4종만 (서버 전용).
 *
 * | 문의 | env | 솔라피 변수 |
 * |------|-----|-------------|
 * | 전세버스 | SOLAPI_TPL_BUS | 고객명, 이용일, 출발지, 도착지, 인원수 |
 * | 국외연수 | SOLAPI_TPL_TRAINING | 고객명, 연수지, 인원수, 서비스범위 |
 * | 기관 | SOLAPI_TPL_INSTITUTION | 고객명, 기관명, 희망국가도시, 인원수, 통역희망 |
 * | 우리견적 | SOLAPI_TPL_PRIVATE_QUOTE | 고객명, 여행지, 인원수, 출발희망 |
 *
 * `travel_consult`(헤더·/inquiry?type=travel 일반 여행 상담) — **별도 알림톡 템플릿 없음**.
 * 고객 알림은 LMS 폴백. (DB inquiryType은 유지, 솔라피 5번째 템플릿 사용 안 함)
 *
 * API variables 키는 `#{이름}` (`lib/solapi-kakao-variables.ts`).
 */

import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

/** 솔라피에 등록된 상담신청 알림톡 4종만 */
export type InquiryCustomerAlimtalkKind =
  | 'private_quote'
  | 'institution_request'
  | 'overseas_training_quote'
  | 'bus_quote'

export type InquiryCustomerAlimtalkContext = {
  inquiryId: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  payloadJson: string | null
  productLabel: string
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

export const TEMPLATE_ENV_KEYS: Record<InquiryCustomerAlimtalkKind, string> = {
  private_quote: 'SOLAPI_TPL_PRIVATE_QUOTE',
  institution_request: 'SOLAPI_TPL_INSTITUTION',
  overseas_training_quote: 'SOLAPI_TPL_TRAINING',
  bus_quote: 'SOLAPI_TPL_BUS',
}

/**
 * `inquiryType` + `payloadJson` → 등록된 4종 중 하나. 없으면 null(LMS 폴백).
 */
export function resolveInquiryCustomerAlimtalkKind(
  inquiryType: string,
  payload: Record<string, unknown>,
): InquiryCustomerAlimtalkKind | null {
  if (inquiryType === 'travel_consult' && payload.quoteKind === 'private_custom') {
    return 'private_quote'
  }
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
      JSON.stringify({ envKey, kind }),
    )
    return null
  }
  return raw
}

export function selectInquiryCustomerAlimtalkTemplateId(
  inquiryType: string,
  payload: Record<string, unknown>,
): string | null {
  const kind = resolveInquiryCustomerAlimtalkKind(inquiryType, payload)
  if (!kind) return null
  return readTemplateIdForKind(kind)
}

export function buildInquiryCustomerAlimtalkVariables(
  kind: InquiryCustomerAlimtalkKind,
  ctx: InquiryCustomerAlimtalkContext,
): Record<string, string> {
  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const name = ctx.applicantName.trim() || '-'

  switch (kind) {
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
