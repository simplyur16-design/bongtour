'use client'

import { useState, type ReactNode } from 'react'
import type { ResultItem } from '@/components/products/ProductResultsList'
import {
  DEFAULT_MOBILE_DEPARTURE_PICK,
  MOBILE_DEPARTURE_PICK_OPTIONS,
  mobileDeparturePickView,
  type MobileDeparturePick,
} from '@/lib/mobile-departure-group'

/**
 * 모바일 출발지 두 칸. 기본 인천·김포. 지방은 청주·대구·부산·제주.
 * unknown은 어느 칸에도 보여 주지 않는다.
 * REGRESSION-FREEZE[mobile-departure-group-actual-airport]: missing airport is unknown — manifest
 */
export function MobileDeparturePickButtons({
  pick,
  onChange,
}: {
  pick: MobileDeparturePick
  onChange: (next: MobileDeparturePick) => void
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="출발지">
      {MOBILE_DEPARTURE_PICK_OPTIONS.map((opt) => {
        const on = pick === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={on}
            aria-label={opt.id === 'regional' ? '지방, 청주·대구·부산·제주' : opt.label}
            onClick={() => onChange(opt.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              on
                ? 'border-slate-900 bg-white text-slate-900 shadow-sm'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function MobileDepartureEmptyGroup() {
  return <p className="py-6 text-center text-sm text-slate-700">이 출발지의 상품이 없습니다.</p>
}

export default function MobileDepartureGroupStack({
  items,
  renderItems,
}: {
  items: ResultItem[]
  renderItems: (items: ResultItem[], pick: MobileDeparturePick) => ReactNode
}) {
  const [pick, setPick] = useState<MobileDeparturePick>(DEFAULT_MOBILE_DEPARTURE_PICK)
  const view = mobileDeparturePickView(items, pick)

  return (
    <div>
      <MobileDeparturePickButtons pick={pick} onChange={setPick} />
      {view.empty ? <MobileDepartureEmptyGroup /> : renderItems(view.shown, pick)}
    </div>
  )
}
