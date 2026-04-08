'use client'

import { useState } from 'react'
import {
  buildKakaoCounselSummaryText,
  copyTextAndOpenKakaoOpenChat,
  pushKakaoCounselDataLayer,
  type CounselFromScreen,
  type CounselIntent,
  type CounselPax,
} from '@/lib/kakao-counsel'

export type { CounselIntent, CounselFromScreen, CounselPax }

type Props = {
  intent: CounselIntent
  fromScreen: CounselFromScreen
  productId: string
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
  variant?: 'secondary' | 'kakaoSoft'
  className?: string
  showHelper?: boolean
}

/**
 * 1:1 카카오 상담: 요약 복사 후 오픈채팅 새 탭, dataLayer 이벤트 전송.
 */
export default function KakaoCounselCta({
  intent,
  fromScreen,
  productId,
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
  variant = 'secondary',
  showHelper = true,
  className = '',
}: Props) {
  const [copied, setCopied] = useState(false)

  const base =
    variant === 'kakaoSoft'
      ? 'border border-[#e5d78a] bg-[#FFFBEB] text-[#191919] hover:bg-[#FFF8DC]'
      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'

  const handleClick = async () => {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : null
    const text = buildKakaoCounselSummaryText({
      intent,
      productId,
      productTitle,
      originSource,
      originCode,
      selectedDepartureDate,
      selectedDepartureId,
      preferredDepartureDate,
      pax,
      bookingId: bookingId ?? null,
      quotationKrwTotal: quotationKrwTotal ?? null,
      localFeePerPerson: localFeePerPerson ?? null,
      localFeeCurrency: localFeeCurrency ?? null,
      pageUrl,
    })
    pushKakaoCounselDataLayer({
      intent,
      product_id: productId,
      product_title: productTitle,
      origin_source: originSource,
      origin_code: originCode,
      from_screen: fromScreen,
      selected_departure_date: selectedDepartureDate ?? null,
      selected_departure_id: selectedDepartureId ?? null,
      preferred_departure_date: preferredDepartureDate ?? null,
      adult_count: pax.adult,
      child_bed_count: pax.childBed,
      child_no_bed_count: pax.childNoBed,
      infant_count: pax.infant,
      total_pax: pax.adult + pax.childBed + pax.childNoBed + pax.infant,
      quotation_krw_total: quotationKrwTotal ?? null,
      local_fee_per_person: localFeePerPerson ?? null,
      local_fee_currency: localFeeCurrency ?? null,
      page_url: pageUrl,
    })
    await copyTextAndOpenKakaoOpenChat(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${base}`}
      >
        <span>{copied ? '상담창 열림' : '1:1 카카오 상담하기'}</span>
        {showHelper && !copied && (
          <span className="text-[11px] font-normal text-slate-500">
            상품 정보 자동 전달 + 입력창 비어 있으면 복사된 내용을 붙여넣어 주세요
          </span>
        )}
      </button>
    </div>
  )
}
