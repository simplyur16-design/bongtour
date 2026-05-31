'use client'

import {
  PAX_STEP_BUTTON_CLASS,
  PAX_STEP_DECREMENT_GLYPH,
  PAX_STEP_INCREMENT_GLYPH,
} from '@/lib/product-live-quote-pax-ui'

type TripDatesProps = {
  heroTripDepartureDisplay: string | null
  heroTripReturnDisplay: string | null
  variant: 'desktop' | 'mobile'
}

/** 출발/귀국 — PC 세로, 모바일 가로 한 줄 */
export function QuoteCardTripDatesBox({
  heroTripDepartureDisplay,
  heroTripReturnDisplay,
  variant,
}: TripDatesProps) {
  if (!heroTripDepartureDisplay && !heroTripReturnDisplay) return null

  const departure = heroTripDepartureDisplay ?? '—'
  const returnDisplay = heroTripReturnDisplay ?? '상담 시 안내'

  return (
    <div className="mb-4 rounded-xl border border-bt-border-soft bg-bt-surface-alt px-3 py-2.5 text-center text-sm">
      {variant === 'mobile' ? (
        <div className="flex flex-row items-center justify-center gap-3">
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <span className="text-xs text-bt-meta">출발</span>
            <span className="text-sm font-semibold tabular-nums text-bt-title">{departure}</span>
          </div>
          <span className="shrink-0 text-bt-border-soft" aria-hidden>
            |
          </span>
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <span className="text-xs text-bt-meta">귀국</span>
            <span className="text-sm font-semibold tabular-nums text-bt-title">{returnDisplay}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="flex flex-col items-center gap-0.5">
            <span className="text-bt-meta">출발</span>
            <span className="font-semibold tabular-nums text-bt-title">{departure}</span>
          </p>
          <p className="flex flex-col items-center gap-0.5">
            <span className="text-bt-meta">귀국</span>
            <span className="font-semibold tabular-nums text-bt-title">{returnDisplay}</span>
          </p>
        </div>
      )}
    </div>
  )
}

type PaxStepperRowProps = {
  label: string
  ageLine: string
  count: number
  atMin: boolean
  onDecrease: () => void
  onIncrease: () => void
  decreaseAria: string
  increaseAria: string
  unitPrice: number | null
  showUnitPrice: boolean
  perPersonSuffix?: string
}

/** 인원 행 — 좌: (라벨+나이 inline) + 가격 아래 / 우: stepper (원래 카드 구조) */
export function QuoteCardPaxStepperRow({
  label,
  ageLine,
  count,
  atMin,
  onDecrease,
  onIncrease,
  decreaseAria,
  increaseAria,
  unitPrice,
  showUnitPrice,
  perPersonSuffix = '원',
}: PaxStepperRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DAD4EE] bg-[#FAFAFC] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-nowrap items-baseline gap-x-2 whitespace-nowrap">
          <span className="text-sm font-semibold fit-tx-primary">{label}</span>
          <span className="text-[10px] fit-tx-meta">{ageLine}</span>
        </div>
        {showUnitPrice && unitPrice != null && unitPrice > 0 ? (
          <div className="mt-0.5 text-base font-semibold tabular-nums fit-tx-price">
            {unitPrice.toLocaleString('ko-KR')}
            {perPersonSuffix}
          </div>
        ) : null}
      </div>
      <div className="grid h-9 w-[7rem] shrink-0 grid-cols-[2rem_1fr_2rem] items-center gap-1">
        <button
          type="button"
          onClick={onDecrease}
          disabled={atMin}
          className={PAX_STEP_BUTTON_CLASS}
          aria-label={decreaseAria}
        >
          {PAX_STEP_DECREMENT_GLYPH}
        </button>
        <span className="min-w-[28px] text-center text-lg font-bold tabular-nums text-[#1F1B2D]">
          {count}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          className={PAX_STEP_BUTTON_CLASS}
          aria-label={increaseAria}
        >
          {PAX_STEP_INCREMENT_GLYPH}
        </button>
      </div>
    </div>
  )
}
