/**
 * 네이버 톡톡 상담 진입.
 * 카카오 오픈채팅과 달리 입력창에 자유 텍스트를 URL로 넣는 방식은 제한적이며,
 * 파트너센터에서 제공하는 **상담 진입 URL + ref(유입 페이지)** 조합이 일반적이다.
 * @see https://talk.naver.com — `NEXT_PUBLIC_NAVER_TALKTALK_URL` 경로는 **챗봇 API·Webhook을 켠 그 프로필의 채팅 URL**과 한 글자까지 같아야 함. 다르면 고객 화면이 중지·오상대로 보이거나 Webhook이 안 옴.
 */
import type { CounselChannelCommonInput } from '@/lib/booking-counsel-contract'
import { buildCounselChannelSummary } from '@/lib/booking-counsel-contract'

export const NAVER_TALKTALK_ENTRY_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAVER_TALKTALK_URL?.trim()) || ''

/** 톡톡 프로필 홈(선택). 비우면 CTA에서 프로필 링크 미표시. */
export const NAVER_TALKTALK_PROFILE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAVER_TALKTALK_PROFILE_URL?.trim()) || ''

export function buildNaverTalktalkCounselSummaryText(input: CounselChannelCommonInput): string {
  return buildCounselChannelSummary('[네이버 톡톡 상담]', input)
}

/**
 * 탭 단위 유입 구분값. 네이버 `open` 이벤트의 `options.from`으로 전달될 수 있음(챗봇 API 문서).
 * 파트너 계정과 같은 브라우저 세션을 섞지 않도록, 고객 테스트는 시크릿/다른 브라우저 권장 — UI 안내 참고.
 */
function talkSessionFromToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const k = 'bongtour_naver_talk_from'
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return ''
  }
}

/**
 * 톡톡 진입 URL에 `ref`(현재 페이지), `from`(탭별 유입 토큰)을 붙인다.
 * 톡톡 URL이 비어 있으면 null.
 */
export function buildNaverTalktalkEntryUrl(pageUrl: string | null): string | null {
  const base = NAVER_TALKTALK_ENTRY_URL.trim()
  if (!base) return null
  const qs: string[] = []
  const ref = (pageUrl ?? '').trim()
  if (ref) qs.push(`ref=${encodeURIComponent(ref)}`)
  const from = talkSessionFromToken()
  if (from) qs.push(`from=${encodeURIComponent(from)}`)
  if (qs.length === 0) return base
  const joiner = base.includes('?') ? '&' : '?'
  return `${base}${joiner}${qs.join('&')}`
}

export type NaverTalktalkCounselClickPayload = {
  product_id: string
  product_title?: string | null
  origin_source: string
  origin_code?: string | null
  listing_product_number?: string | null
  from_screen: string
  selected_departure_date?: string | null
  selected_departure_id?: string | null
  preferred_departure_date?: string | null
  booking_request_id?: number | null
  page_url?: string | null
}

export function pushNaverTalktalkCounselDataLayer(payload: NaverTalktalkCounselClickPayload): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { dataLayer?: Record<string, unknown>[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({
    event: 'naver_talktalk_counsel_click',
    product_id: payload.product_id,
    origin_source: payload.origin_source,
    from_screen: payload.from_screen,
    product_title: payload.product_title ?? null,
    origin_code: payload.origin_code ?? null,
    listing_product_number: payload.listing_product_number ?? null,
    selected_departure_date: payload.selected_departure_date ?? null,
    selected_departure_id: payload.selected_departure_id ?? null,
    preferred_departure_date: payload.preferred_departure_date ?? null,
    booking_request_id: payload.booking_request_id ?? null,
    page_url: payload.page_url ?? null,
  })
}

export async function copyTextAndOpenNaverTalktalk(summaryText: string, pageUrl: string | null): Promise<void> {
  try {
    await navigator.clipboard.writeText(summaryText)
  } catch {
    // 복사 실패해도 창은 연다
  }
  const url = buildNaverTalktalkEntryUrl(pageUrl)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
