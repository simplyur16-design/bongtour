/**
 * 문의·견적 접수 성공 후 공개 URL SSOT (Google Ads 리드 전환 페이지).
 * REGRESSION-FREEZE[inquiry-thank-you-redirect]: 접수 성공 → /inquiry/thank-you — manifest
 */
import { INQUIRY_KINDS, type InquiryKind } from '@/lib/inquiry-page'

/** 안정 경로 — Ads 전환 URL은 쿼리 없이 이 path만 쓰면 됨 */
export const INQUIRY_THANK_YOU_PATH = '/inquiry/thank-you'

export type InquiryThankYouBuildInput = {
  kind?: InquiryKind | string | null
  /** 운영자 알림 지연 안내 */
  delayed?: boolean
  /** 카카오 CTA 노출 */
  contact?: 'email' | 'kakao' | 'both' | null
  /** 우리견적(`/quote/private`) 등 */
  from?: 'private' | string | null
  /** 블로그 영문 유입 */
  lang?: 'en' | string | null
}

export function normalizeInquiryThankYouKind(raw: string | null | undefined): InquiryKind | null {
  const u = (raw ?? '').toLowerCase().trim()
  return (INQUIRY_KINDS as readonly string[]).includes(u) ? (u as InquiryKind) : null
}

export function buildInquiryThankYouHref(input: InquiryThankYouBuildInput = {}): string {
  const p = new URLSearchParams()
  const kind = normalizeInquiryThankYouKind(
    typeof input.kind === 'string' ? input.kind : input.kind ?? null,
  )
  if (kind) p.set('type', kind)
  if (input.delayed) p.set('delayed', '1')
  if (input.contact === 'kakao' || input.contact === 'both') p.set('contact', input.contact)
  if (input.from === 'private') p.set('from', 'private')
  if (input.lang === 'en') p.set('lang', 'en')
  const q = p.toString()
  return q ? `${INQUIRY_THANK_YOU_PATH}?${q}` : INQUIRY_THANK_YOU_PATH
}
