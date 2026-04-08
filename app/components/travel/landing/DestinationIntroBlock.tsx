'use client'

import type { ReactNode } from 'react'

export type DestinationIntroBlockProps = {
  /** 선택된 목적지 요약 (메가메뉴·트리·검색 연동) */
  summaryLabel: string
  /** 지역 한 줄 브리핑 */
  briefing: string
  onClear: () => void
  /** 결과 필터 칩·추가 UI */
  filterSlot?: ReactNode
}

/**
 * 지역 클릭/검색 후 상품 리스트 상단 — 브리핑 + 초기화.
 * 국내 랜딩에서도 동일 props로 재사용 가능.
 */
export default function DestinationIntroBlock({
  summaryLabel,
  briefing,
  onClear,
  filterSlot,
}: DestinationIntroBlockProps) {
  if (!summaryLabel.trim()) return null
  return (
    <section
      id="travel-os-destination-intro"
      className="scroll-mt-24 border-b border-bt-border bg-bt-surface/90 px-4 py-5 sm:px-6"
      aria-label="선택한 목적지 안내"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-subtle">선택한 조건</p>
            <p className="mt-1 text-lg font-semibold text-bt-ink">{summaryLabel}</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bt-muted">{briefing}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg border border-bt-border bg-white px-3 py-2 text-xs font-medium text-bt-muted hover:border-bt-accent/40 hover:text-bt-ink"
          >
            목적지 조건 지우기
          </button>
        </div>
        {filterSlot ? <div className="mt-4 border-t border-bt-border/70 pt-4">{filterSlot}</div> : null}
      </div>
    </section>
  )
}
