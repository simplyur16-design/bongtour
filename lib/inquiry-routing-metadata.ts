/**
 * 문의 라우팅·메일 메타 SSOT (공급사 어댑터와 무관).
 * URL kind ↔ API `CustomerInquiry.inquiryType` ↔ 알림 prefix ↔ 운영자 메일 한 줄 라벨.
 */

import { inquiryTypeDisplayLabel } from '@/lib/admin-inquiry'

/** 운영자 메일 제목·요약 블록 첫머리 — `resolveInquiryAlertPrefix` 결과와 동일 문자열을 유지할 것 */
export const INQUIRY_MAIL_PREFIX = {
  TRAVEL_PRODUCT: '[여행상품 문의]',
  TRAVEL_GENERAL: '[일반 문의]',
  PRIVATE_QUOTE: '[우리여행 견적]',
  FLIGHT: '[항공권 문의]',
  INSTITUTION: '[기관/단체 문의]',
  INTERPRETER: '[통역 문의]',
  TRAINING: '[국외연수 문의]',
  BUS: '[전세버스 문의]',
  /** API 검증을 우회한 비정상 레코드·스크립트용. `travel_consult`와 혼동되지 않음 */
  FALLBACK: '[문의 접수]',
} as const

export type InquiryMailPrefix = (typeof INQUIRY_MAIL_PREFIX)[keyof typeof INQUIRY_MAIL_PREFIX]

/** 메일 본문 `■ 문의 메타` 줄 — API 타입 + 관리자 목록과 동일 라벨 */
export function formatInquiryTypeForAdminEmailLine(inquiryType: string, payloadJson: string | null): string {
  let quoteKind: string | null = null
  if (payloadJson) {
    try {
      const o = JSON.parse(payloadJson) as { quoteKind?: unknown }
      quoteKind = typeof o?.quoteKind === 'string' ? o.quoteKind : null
    } catch {
      quoteKind = null
    }
  }
  const label = inquiryTypeDisplayLabel(inquiryType, quoteKind)
  return `${inquiryType} (${label})`
}
