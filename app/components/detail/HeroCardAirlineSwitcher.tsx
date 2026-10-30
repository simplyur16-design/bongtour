'use client'

import { useProductAirlineFilter } from '@/app/components/detail/product-airline-filter-context'
import {
  A5_HERO_CARD_AIRLINE_LABELS as L,
  otherAirlineRows,
  resolveCurrentDepartureAirlineOption,
  shouldShowHeroCardAirlineSwitch,
} from '@/lib/detail-airline-two-buttons'

/**
 * 히어로 가격카드 안 '다른 항공사' 선택기 (A-5, 사장님 23:47).
 * - 가격행 있는 항공사 2곳 이상일 때만. 단일 항공사 → null(카드는 항공사 이름만).
 * - 가격: 같은 상품 공개 예약가능 가격행(성인 1인)에서 항공사별 가장 낮은 값만 — 추정·생성 금지.
 * - 고르면 기존 항공사 필터 `select(label)` → `?airline=` 동일 동작 → 카드 항공사·출발/귀국·가격이 그 항공사 회차로 바뀜.
 * - 고정 위치·포털 없음: 카드(데스크톱 aside overflow-hidden, 모바일 흐름 배치) 안에서만 그린다.
 * REGRESSION-FREEZE[a5-two-buttons-1030]: 카드 선택기 — manifest
 */
export function useHeroCardAirlineSwitch() {
  const ctx = useProductAirlineFilter()
  const visible = shouldShowHeroCardAirlineSwitch(ctx.data)
  const current = visible ? resolveCurrentDepartureAirlineOption(ctx.data, ctx.selected, ctx.currentDeparture) : null
  const others = visible ? otherAirlineRows(ctx.data, current?.label ?? null) : []
  return { visible, current, others, selected: ctx.selected, select: ctx.select }
}

export function HeroCardAirlineSwitchButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { visible, others } = useHeroCardAirlineSwitch()
  if (!visible || others.length === 0) return null
  return (
    <div className="mt-2 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-teal-600 bg-white px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
        data-hero-card-airline-switch
      >
        {open ? L.closeButton : `${L.openButton} (${others.length}곳)`}
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
    </div>
  )
}

export function HeroCardAirlineList({ onDone }: { onDone: () => void }) {
  const { visible, others, selected, select } = useHeroCardAirlineSwitch()
  if (!visible) return null
  const pick = (label: string | null) => {
    onDone()
    select(label)
  }
  return (
    <div className="mt-3 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft p-2.5" data-hero-card-airline-list>
      <p className="bt-wrap text-center text-[11px] font-semibold leading-snug text-bt-meta">{L.listTitle}</p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {others.map((o) => (
          <li key={o.param} className="min-w-0">
            <button
              type="button"
              onClick={() => pick(o.label)}
              className="flex w-full min-h-[44px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-center hover:border-teal-600 hover:bg-teal-50"
              data-hero-card-airline-option={o.param}
            >
              <span className="w-full truncate text-xs font-semibold text-slate-900">{o.label}</span>
              {o.lowestPriceKrw != null ? (
                <span className="text-xs font-bold tabular-nums text-teal-700" data-hero-card-airline-price>
                  {o.lowestPriceKrw.toLocaleString('ko-KR')}
                  {L.priceSuffix}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500" data-hero-card-airline-no-price>
                  {L.noPrice}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="mt-1.5 text-center">
          <button type="button" className="text-[11px] text-teal-700 underline" onClick={() => pick(null)} data-hero-card-airline-all>
            {L.showAll}
          </button>
        </div>
      ) : null}
    </div>
  )
}
