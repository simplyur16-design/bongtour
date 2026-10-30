'use client'

import { useState } from 'react'
import { useProductAirlineFilter } from '@/app/components/detail/product-airline-filter-context'
import {
  A5_TWO_BUTTON_LABELS as L,
  otherAirlineRows,
  resolveCurrentDepartureAirlineOption,
  shouldShowOtherAirlineButton,
} from '@/lib/detail-airline-two-buttons'

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

const btnBase =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors'
const btnPrimary = `${btnBase} border-teal-600 bg-teal-600 text-white hover:bg-teal-700`
const btnOutline = `${btnBase} border-teal-600 bg-white text-teal-700 hover:bg-teal-50`

/**
 * 상세 항공사 영역 (A-5 두 버튼 설계 초안).
 * - 상단: 지금 선택된 출발일의 항공사만.
 * - 버튼 1 '출발일 변경해서 보기': 같은 항공사 회차만으로 좁힌 본문 출발일 달력을 연다.
 * - 버튼 2 '다른 항공사 찾기': 같은 상품의 다른 항공사별 가장 낮은 공개 요금(기존 가격행만) → 고르면 `?airline=`.
 *   항공사 1곳뿐이면 버튼 2 숨김. 가격행 없으면 가격 표시 안 함.
 * REGRESSION-FREEZE[airline-variant-group]: `?airline=` 선택 시 그 항공사 회차·가격만 — manifest
 * REGRESSION-FREEZE[a5-two-buttons-1030]: 상단 = 선택 출발 회차 항공사 · 버튼 2개 · 단일 항공사 버튼 2 숨김 — manifest
 */
export default function ProductAirlinePricePanelClient() {
  const { data, selected, select, currentDeparture, requestDeparturePicker } = useProductAirlineFilter()
  const [othersOpen, setOthersOpen] = useState(false)

  if (!data || data.options.length === 0) return null

  const current = resolveCurrentDepartureAirlineOption(data, selected, currentDeparture)
  const showOthers = shouldShowOtherAirlineButton(data)
  const others = showOthers ? otherAirlineRows(data, current?.label ?? null) : []

  const onChangeDeparture = () => {
    setOthersOpen(false)
    // 같은 항공사 회차만: 아직 항공사 필터가 없으면 지금 출발일의 항공사로 좁힌 뒤 달력 열기
    if (!selected && current && showOthers) select(current.label)
    requestDeparturePicker()
  }

  const onPickAirline = (label: string | null) => {
    setOthersOpen(false)
    select(label)
  }

  return (
    <section
      aria-label="항공사"
      className="mx-auto w-full max-w-6xl px-4 pt-3"
      data-airline-price-panel
      data-airline-two-buttons
      data-selected-airline={selected?.param ?? ''}
      data-current-airline={current?.param ?? ''}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <p className="text-sm text-slate-600" data-current-airline-line>
          {L.currentAirlinePrefix}{' '}
          <strong className="text-base font-bold text-slate-900">{current ? current.label : L.unknownAirline}</strong>
        </p>
        <div className={`mt-2.5 grid gap-2 ${showOthers ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:flex-wrap`}>
          <button type="button" className={btnPrimary} onClick={onChangeDeparture} data-airline-btn-change-departure>
            {L.changeDeparture}
          </button>
          {showOthers ? (
            <button
              type="button"
              className={btnOutline}
              aria-expanded={othersOpen}
              onClick={() => setOthersOpen((v) => !v)}
              data-airline-btn-other-airline
            >
              {L.otherAirline}
            </button>
          ) : null}
        </div>
        {current && showOthers ? (
          <p className="mt-1.5 text-[11px] text-slate-500">
            {current.label} 출발일만 보여 드려요.
          </p>
        ) : null}

        {showOthers && othersOpen ? (
          <div className="mt-3 border-t border-slate-100 pt-3" data-airline-other-list>
            <p className="text-xs font-semibold text-slate-600">{L.otherListTitle}</p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {others.map((o) => (
                <li key={o.param}>
                  <button
                    type="button"
                    onClick={() => onPickAirline(o.label)}
                    className="flex w-full min-h-[48px] items-center justify-between gap-3 px-3 py-2 text-left hover:bg-teal-50"
                    data-airline-other-row={o.param}
                  >
                    <span className="text-sm font-semibold text-slate-900">{o.label}</span>
                    <span className="flex items-center gap-2 text-right">
                      <span className="text-[11px] text-slate-500">출발 {o.departureCount}회</span>
                      {o.lowestPriceKrw != null ? (
                        <span className="text-sm font-bold text-teal-700" data-airline-other-price>
                          {won(o.lowestPriceKrw)}~
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500" data-airline-other-no-price>
                          {L.noPrice}
                        </span>
                      )}
                      <span aria-hidden className="text-slate-400">›</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected ? (
              <button
                type="button"
                className="mt-2 text-xs text-teal-700 underline"
                onClick={() => onPickAirline(null)}
                data-airline-filter-all
              >
                항공사 구분 없이 전체 출발일 보기
              </button>
            ) : null}
          </div>
        ) : null}

        {selected ? (
          <p className="mt-2 text-[11px] text-slate-500">
            아래 달력·가격·항공편·귀국일은 {selected.label} 출발일 기준이고, 가격은 성인 1인 기준입니다.
          </p>
        ) : null}
      </div>
    </section>
  )
}
