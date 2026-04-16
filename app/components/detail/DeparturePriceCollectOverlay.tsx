'use client'

import { departurePriceCollectUiCopy } from '@/lib/departure-price-collect-ui'

type Props = {
  phase: 'collecting' | 'delayed_collecting'
  onContinueBooking?: () => void
}

/**
 * 날짜 선택 등으로 on-demand 수집이 돌 때 — 전면 안내 + (선택) 접수 진행.
 * 예약 모달이 열리면 부모에서 이 오버레이를 숨겨 접수와 병행 가능하게 한다.
 */
export default function DeparturePriceCollectOverlay({ phase, onContinueBooking }: Props) {
  const delayed = phase === 'delayed_collecting'

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="dep-collect-title"
      aria-describedby="dep-collect-desc"
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-bt-border-soft bg-bt-surface px-6 py-7 shadow-lg">
        <h2 id="dep-collect-title" className="text-center text-base font-semibold text-bt-card-title">
          {departurePriceCollectUiCopy.overlayTitlePrimary}
        </h2>
        <p id="dep-collect-desc" className="mt-3 text-center text-sm leading-relaxed text-bt-body">
          {departurePriceCollectUiCopy.overlayBodyPrimary}
        </p>
        {delayed ? (
          <div className="mt-4 space-y-2 rounded-lg border border-bt-border-soft bg-bt-surface-alt px-3 py-3 text-center text-sm leading-relaxed text-bt-body">
            <p>{departurePriceCollectUiCopy.overlayDelayLine1}</p>
            <p className="text-bt-meta">{departurePriceCollectUiCopy.overlayDelayLine2}</p>
            <p className="text-bt-meta">{departurePriceCollectUiCopy.overlayDelayLine3}</p>
          </div>
        ) : null}
        <div
          className="mx-auto mt-6 h-10 w-10 rounded-full border-2 border-bt-border-soft border-t-bt-card-title animate-spin"
          style={{ animationDuration: '0.9s' }}
          aria-hidden
        />
        {onContinueBooking ? (
          <div className="mt-6 space-y-2 border-t border-bt-border-soft pt-5">
            <p className="text-center text-[11px] leading-relaxed text-bt-meta">
              {departurePriceCollectUiCopy.overlayContinueBookingHint}
            </p>
            <button
              type="button"
              onClick={onContinueBooking}
              className="w-full rounded-lg border border-bt-cta-primary bg-bt-surface py-2.5 text-sm font-medium text-bt-cta-primary hover:bg-bt-surface-alt"
            >
              {departurePriceCollectUiCopy.overlayContinueBookingCta}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
