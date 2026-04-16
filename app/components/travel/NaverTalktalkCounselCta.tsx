'use client'

import { useState } from 'react'
import type { CounselFromScreen, CounselPax } from '@/lib/kakao-counsel'
import {
  buildNaverTalktalkCounselSummaryText,
  copyTextAndOpenNaverTalktalk,
  NAVER_TALKTALK_ENTRY_URL,
  pushNaverTalktalkCounselDataLayer,
} from '@/lib/naver-talktalk-counsel'

type Props = {
  fromScreen: CounselFromScreen
  productId: string
  listingProductNumber?: string | null
  productTitle: string
  originSource: string
  originCode: string
  selectedDepartureDate?: string | null
  selectedDepartureId?: string | null
  preferredDepartureDate?: string | null
  pax: CounselPax
  bookingId?: number | null
  quotationKrwTotal?: number | null
  localFeePerPerson?: number | null
  localFeeCurrency?: string | null
  customerMemo?: string | null
  advisoryLabel?: string | null
  pricingMode?: string | null
  isCollectingPrices?: boolean
  className?: string
  showHelper?: boolean
}

/**
 * 네이버 톡톡: 요약은 클립보드에 복사하고, 톡톡 진입 URL(설정 시)을 연다.
 * URL 미설정 시 버튼은 비활성(운영에서 env만 채우면 활성화).
 */
export default function NaverTalktalkCounselCta({
  fromScreen,
  productId,
  listingProductNumber,
  productTitle,
  originSource,
  originCode,
  selectedDepartureDate,
  selectedDepartureId,
  preferredDepartureDate,
  pax,
  bookingId,
  quotationKrwTotal,
  localFeePerPerson,
  localFeeCurrency,
  customerMemo,
  advisoryLabel,
  pricingMode,
  isCollectingPrices,
  className = '',
  showHelper = true,
}: Props) {
  const [copied, setCopied] = useState(false)
  const enabled = Boolean(NAVER_TALKTALK_ENTRY_URL.trim())

  const handleClick = async () => {
    if (!enabled) return
    const pageUrl = typeof window !== 'undefined' ? window.location.href : null
    const common = {
      productId,
      originCode,
      listingProductNumber: listingProductNumber ?? null,
      productTitle,
      originSource,
      selectedDepartureDate: selectedDepartureDate ?? null,
      selectedDepartureId: selectedDepartureId ?? null,
      preferredDepartureDate: preferredDepartureDate ?? null,
      pax,
      bookingId: bookingId ?? null,
      pageUrl,
      customerMemo: customerMemo ?? null,
      advisoryLabel: advisoryLabel ?? null,
      pricingMode: pricingMode ?? null,
      isCollectingPrices: Boolean(isCollectingPrices),
      quotationKrwTotal: quotationKrwTotal ?? null,
      localFeePerPerson: localFeePerPerson ?? null,
      localFeeCurrency: localFeeCurrency ?? null,
    }
    const text = buildNaverTalktalkCounselSummaryText(common)
    pushNaverTalktalkCounselDataLayer({
      product_id: productId,
      product_title: productTitle,
      origin_source: originSource,
      origin_code: originCode,
      listing_product_number: listingProductNumber?.trim() || null,
      from_screen: fromScreen,
      selected_departure_date: selectedDepartureDate ?? null,
      selected_departure_id: selectedDepartureId ?? null,
      preferred_departure_date: preferredDepartureDate ?? null,
      booking_request_id: bookingId ?? null,
      page_url: pageUrl,
    })
    await copyTextAndOpenNaverTalktalk(text, pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!enabled}
        className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition ${
          enabled
            ? 'border-[#03C75A]/40 bg-[#E8FFF3] text-[#0a3d2c] hover:bg-[#d6f5e6]'
            : 'cursor-not-allowed border-bt-border-soft bg-bt-surface-soft text-bt-disabled'
        }`}
      >
        <span>{!enabled ? '네이버 톡톡(연결 준비 중)' : copied ? '톡톡 창 열림' : '네이버 톡톡 상담하기'}</span>
        {showHelper && enabled && !copied && (
          <span className="text-[11px] font-normal text-bt-meta">
            요약은 클립보드에 복사됩니다. 톡톡 입력창에 붙여넣어 주세요.
          </span>
        )}
        {!enabled && (
          <span className="text-[11px] font-normal text-bt-subtle">NEXT_PUBLIC_NAVER_TALKTALK_URL 설정 후 사용</span>
        )}
      </button>
    </div>
  )
}
