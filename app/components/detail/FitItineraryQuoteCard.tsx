'use client'

import Link from 'next/link'
import ShareActions from '@/app/components/detail/ShareActions'
import {
  buildProductLiveQuoteShareSummary,
  PRODUCT_LIVE_QUOTE_CARD_COPY,
} from '@/lib/product-live-quote-card-copy'
import {
  QuoteCardPaxStepperRow,
  QuoteCardTripDatesBox,
} from '@/app/components/detail/QuoteCardLayoutBlocks'

type FitPax = { adult: number; childBed: number; infant: number }

const FIT_PAX_ROWS = [
  { key: 'adult' as const, label: '\uC131\uC778', ageLine: '\uB9CC 12\uC138 \uC774\uC0C1', minVal: 1 },
  { key: 'childBed' as const, label: '\uC544\uB3D9', ageLine: '\uB9CC 2~11\uC138', minVal: 0 },
  { key: 'infant' as const, label: '\uC720\uC544', ageLine: '\uB9CC 2\uC138 \uBBF8\uB9CC', minVal: 0 },
] as const

type Props = {
  productTitle: string
  originCode: string
  destination: string
  duration: string
  airline?: string | null
  heroTripDepartureDisplay: string | null
  heroTripReturnDisplay: string | null
  pax: FitPax
  updatePax: (key: keyof FitPax, delta: number) => void
  adultPriceUnit: number
  childBedPriceUnit: number
  infantPriceUnit: number
  totalQuote: number | null
  ctaHref: string
  selectedDate: string | null
  computedReturnDate: string | null
  variant?: 'desktop' | 'mobile'
}

/** 자유여행 상세 — 패키지 인원 선택 카드와 동일 레이아웃 (코드 격리 fork) */
export default function FitItineraryQuoteCard({
  productTitle,
  originCode,
  destination,
  duration,
  airline,
  heroTripDepartureDisplay,
  heroTripReturnDisplay,
  pax,
  updatePax,
  adultPriceUnit,
  childBedPriceUnit,
  infantPriceUnit,
  totalQuote,
  ctaHref,
  selectedDate,
  computedReturnDate,
  variant = 'desktop',
}: Props) {
  const copy = PRODUCT_LIVE_QUOTE_CARD_COPY
  const isMobile = variant === 'mobile'
  const pad = isMobile ? 'p-4' : 'p-6'
  const tripVariant = isMobile ? 'mobile' : 'desktop'

  const shareSummary = buildProductLiveQuoteShareSummary({
    originCode,
    destination,
    duration,
    airline,
    selectedDate,
    returnDate: computedReturnDate,
  })

  const unitByKey: Record<keyof FitPax, number> = {
    adult: adultPriceUnit,
    childBed: childBedPriceUnit,
    infant: infantPriceUnit,
  }

  const showQuotationTotal = totalQuote != null && totalQuote > 0

  return (
    <div className={`bt-card-strong border-2 border-bt-border-soft ${pad}`}>
      <QuoteCardTripDatesBox
        heroTripDepartureDisplay={heroTripDepartureDisplay}
        heroTripReturnDisplay={heroTripReturnDisplay}
        variant={tripVariant}
      />

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1F1B2D]">{copy.paxSectionTitle}</p>
        <div className="space-y-2.5">
          {FIT_PAX_ROWS.map((row) => {
            const unit = unitByKey[row.key]
            const count = pax[row.key]
            const atMin = count <= row.minVal
            return (
              <QuoteCardPaxStepperRow
                key={row.key}
                label={row.label}
                ageLine={row.ageLine}
                count={count}
                atMin={atMin}
                onDecrease={() => updatePax(row.key, -1)}
                onIncrease={() => updatePax(row.key, 1)}
                decreaseAria={copy.paxDecreaseAria(row.label)}
                increaseAria={copy.paxIncreaseAria(row.label)}
                unitPrice={unit}
                showUnitPrice
              />
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-bt-meta">{copy.paxFootnote}</p>
        {showQuotationTotal ? (
          <div
            className="mt-3 rounded-xl border border-[#DAD4EE] bg-white px-3 py-3 text-center"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bt-meta">
              {copy.quotationTotalLabel}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-[#85510B]">
              {totalQuote.toLocaleString('ko-KR')}
              <span className="ml-0.5 text-base font-bold">원</span>
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-bt-meta">{copy.quotationTotalHint}</p>
          </div>
        ) : null}
      </div>

      <ShareActions title={productTitle} summaryLine={shareSummary} className="mt-3" />
      <Link href={ctaHref} className={copy.bookingCtaButtonClass}>
        {copy.bookingCta}
      </Link>
    </div>
  )
}
