/**
 * 카카오 상담: 유형·요약 문구·GA dataLayer (GTM 호환)
 * @see docs/KAKAO-COUNSEL-ROADMAP.md
 * @see docs/GTM-KAKAO-COUNSEL-GA4.md — GTM→GA4 매핑·검증
 */

import { buildCounselChannelSummary } from '@/lib/booking-counsel-contract'
import { KAKAO_OPEN_CHAT_URL } from '@/lib/kakao-open-chat'

export type CounselIntent = 'booking' | 'departure' | 'benefit' | 'schedule'

/** dataLayer `from_screen` / 분석용 화면 식별자 */
export type CounselFromScreen =
  | 'product_detail_desktop'
  | 'product_detail_mobile'
  | 'booking_success_modal'
  /** 혜택/프로모 진입 UI 연결 시 동일 CTA에 `intent="benefit"`과 함께 사용 */
  | 'product_detail_benefit_section'
  /** 일정·쇼핑·현지옵션 등 진입 UI 연결 시 동일 CTA에 `intent="schedule"`과 함께 사용 */
  | 'product_detail_schedule_section'

export type CounselPax = {
  adult: number
  childBed: number
  childNoBed: number
  infant: number
}

export type BuildKakaoCounselSummaryParams = {
  intent: CounselIntent
  productId: string
  productTitle: string
  originSource: string
  originCode: string
  /** 리스트/공급사 노출 상품번호 — 없으면 요약에서 노출코드 줄만 강조 */
  listingProductNumber?: string | null
  selectedDepartureDate?: string | null
  selectedDepartureId?: string | null
  preferredDepartureDate?: string | null
  pax: CounselPax
  bookingId?: number | null
  /** 선택 출발일 기준 패키지 총액(원화) */
  quotationKrwTotal?: number | null
  /** 현지 지불 경비(인당 참고) */
  localFeePerPerson?: number | null
  localFeeCurrency?: string | null
  /** 사용자가 보고 있던 페이지 URL */
  pageUrl?: string | null
  /** 접수 폼 등에서 넘기는 고객 메모(고정 스냅샷) */
  customerMemo?: string | null
  /** 변동형: 일정 상태 라벨(참고 블록) */
  advisoryLabel?: string | null
  pricingMode?: string | null
  isCollectingPrices?: boolean
}

export function buildKakaoCounselSummaryText(p: BuildKakaoCounselSummaryParams): string {
  return buildCounselChannelSummary('[예약 상담]', {
    productId: String(p.productId),
    originCode: p.originCode,
    listingProductNumber: p.listingProductNumber ?? null,
    productTitle: p.productTitle,
    originSource: p.originSource,
    selectedDepartureDate: p.selectedDepartureDate ?? null,
    selectedDepartureId: p.selectedDepartureId ?? null,
    preferredDepartureDate: p.preferredDepartureDate ?? null,
    pax: p.pax,
    bookingId: p.bookingId ?? null,
    pageUrl: p.pageUrl ?? null,
    customerMemo: p.customerMemo ?? null,
    advisoryLabel: p.advisoryLabel ?? null,
    pricingMode: p.pricingMode ?? null,
    isCollectingPrices: p.isCollectingPrices,
    quotationKrwTotal: p.quotationKrwTotal ?? null,
    localFeePerPerson: p.localFeePerPerson ?? null,
    localFeeCurrency: p.localFeeCurrency ?? null,
  })
}

export type KakaoCounselClickPayload = {
  intent: CounselIntent
  product_id: string
  product_title?: string
  origin_source: string
  /** 공급사/리스트 노출 상품코드(요약의 listing 줄과 동일 우선순위) */
  origin_code?: string
  /** 리스트 상품번호가 origin_code와 다를 때 구분용(선택) */
  listing_product_number?: string | null
  from_screen: CounselFromScreen
  selected_departure_date?: string | null
  selected_departure_id?: string | null
  preferred_departure_date?: string | null
  booking_request_id?: number | null
  adult_count?: number
  child_bed_count?: number
  child_no_bed_count?: number
  infant_count?: number
  total_pax?: number
  quotation_krw_total?: number | null
  local_fee_per_person?: number | null
  local_fee_currency?: string | null
  page_url?: string | null
}

/**
 * GTM/GA4: `event: kakao_counsel_click` + 커스텀 파라미터.
 * gtag 미설치 환경에서도 dataLayer만 쌓이도록 처리.
 */
export function pushKakaoCounselDataLayer(payload: KakaoCounselClickPayload): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { dataLayer?: Record<string, unknown>[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({
    event: 'kakao_counsel_click',
    intent: payload.intent,
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
    adult_count: payload.adult_count ?? null,
    child_bed_count: payload.child_bed_count ?? null,
    child_no_bed_count: payload.child_no_bed_count ?? null,
    infant_count: payload.infant_count ?? null,
    total_pax: payload.total_pax ?? null,
    quotation_krw_total: payload.quotation_krw_total ?? null,
    local_fee_per_person: payload.local_fee_per_person ?? null,
    local_fee_currency: payload.local_fee_currency ?? null,
    page_url: payload.page_url ?? null,
  })
}

export async function copyTextAndOpenKakaoOpenChat(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 복사 실패해도 채팅은 연다
  }
  const joiner = KAKAO_OPEN_CHAT_URL.includes('?') ? '&' : '?'
  const chatUrl = `${KAKAO_OPEN_CHAT_URL}${joiner}text=${encodeURIComponent(text)}`
  window.open(chatUrl, '_blank', 'noopener,noreferrer')
}
