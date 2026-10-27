'use client'

import { useState } from 'react'
import type { AirlineDepartureOption } from '@/lib/airline-variant-group'
import { useProductAirlineFilter } from '@/app/components/detail/product-airline-filter-context'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']
const DEPARTURES_PREVIEW = 12

function formatYmdKo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return ymd
  const wd = WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d}(${wd})`
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

const chipOn =
  'inline-block rounded-full border border-teal-600 bg-teal-600 px-3 py-1 text-xs font-medium text-white'
const chipOff =
  'inline-block rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-teal-500 hover:text-teal-700'

/**
 * 상세 항공사별 가격 패널 — 선택은 공유 필터(context)로 → 아래 메인 달력·가격도 같은 항공사 회차만.
 * '전체' 로 필터 해제. 항공사 데이터 없는 상품은 렌더 안 함.
 * REGRESSION-FREEZE[airline-variant-group]: `?airline=` 선택 시 그 항공사 회차·가격만 — manifest
 */
export default function ProductAirlinePricePanelClient() {
  const { data, selected, select } = useProductAirlineFilter()
  const options: AirlineDepartureOption[] = data?.options ?? []
  const [showAll, setShowAll] = useState(false)

  if (!data || options.length === 0) return null
  // 항공사 1곳뿐이고 선택도 없으면 패널 생략 (본문 가격과 동일)
  if (options.length < 2 && !selected) return null

  const choose = (label: string | null) => {
    setShowAll(false)
    select(label)
  }

  const deps = selected ? (showAll ? selected.rows : selected.rows.slice(0, DEPARTURES_PREVIEW)) : []

  return (
    <section
      aria-label="항공사별 가격"
      className="mx-auto w-full max-w-6xl px-4 pt-3"
      data-airline-price-panel
      data-selected-airline={selected?.param ?? ''}
    >
      <p className="text-xs font-semibold text-slate-600">항공사별 가격 (예약가능 출발일 기준)</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        <li>
          <button
            type="button"
            aria-pressed={!selected}
            onClick={() => choose(null)}
            className={!selected ? chipOn : chipOff}
            data-airline-filter-all
          >
            전체
          </button>
        </li>
        {options.map((o) => {
          const on = selected?.label === o.label
          return (
            <li key={o.label}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => choose(on ? null : o.label)}
                className={on ? chipOn : chipOff}
              >
                {o.label} {won(o.minPriceKrw)}~
              </button>
            </li>
          )
        })}
      </ul>
      {selected ? (
        <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3" data-airline-price-selected>
          <p className="text-sm font-bold text-slate-900">
            {selected.label} 기준 <span className="text-teal-700">{won(selected.minPriceKrw)}~</span>
            <span className="ml-1 text-xs font-normal text-slate-500">(1인 성인 · 예약가능 {selected.rows.length}회)</span>
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-3 md:grid-cols-4">
            {deps.map((d) => (
              <li key={d[0]} className="flex justify-between gap-2">
                <span>{formatYmdKo(d[1])}</span>
                <span className="font-medium">{won(d[2])}</span>
              </li>
            ))}
          </ul>
          {selected.rows.length > DEPARTURES_PREVIEW ? (
            <button type="button" className="mt-2 text-xs text-teal-700 underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '접기' : `출발일 ${selected.rows.length - DEPARTURES_PREVIEW}개 더보기`}
            </button>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            아래 달력·가격은 {selected.label} 출발일만 표시합니다. 다른 항공사는 &lsquo;전체&rsquo;를 누르세요. 가격은 성인 1인 기준입니다.
          </p>
        </div>
      ) : null}
    </section>
  )
}
