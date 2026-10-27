'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { airlineLabelFromParam } from '@/lib/airline-variant-group'
import type { AirlineDepartureOption } from '@/lib/airline-variant-departures'

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

/** REGRESSION-FREEZE[airline-variant-group]: `?airline=` 선택 시 그 항공사 회차·가격만 — manifest */
export default function ProductAirlinePricePanelClient({ options }: { options: AirlineDepartureOption[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const paramLabel = airlineLabelFromParam(searchParams.get('airline'))
  const fromUrl = paramLabel ? (options.find((o) => o.label === paramLabel)?.label ?? null) : null
  const [picked, setPicked] = useState<string | null>(null)
  const selectedLabel = picked ?? fromUrl
  const selected = useMemo(() => options.find((o) => o.label === selectedLabel) ?? null, [options, selectedLabel])
  const [showAll, setShowAll] = useState(false)

  // 항공사 1곳뿐이고 URL 선택도 없으면 패널 생략 (본문 가격과 동일)
  if (options.length < 2 && !fromUrl) return null

  const choose = (o: AirlineDepartureOption | null) => {
    setPicked(o ? o.label : null)
    setShowAll(false)
    const sp = new URLSearchParams(searchParams.toString())
    if (o) sp.set('airline', o.param)
    else sp.delete('airline')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const deps = selected ? (showAll ? selected.departures : selected.departures.slice(0, DEPARTURES_PREVIEW)) : []

  return (
    <section
      aria-label="항공사별 가격"
      className="mx-auto w-full max-w-6xl px-4 pt-3"
      data-airline-price-panel
      data-selected-airline={selected?.param ?? ''}
    >
      <p className="text-xs font-semibold text-slate-600">항공사별 가격 (예약가능 출발일 기준)</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected?.label === o.label
          return (
            <li key={o.label}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => choose(on ? null : o)}
                className={
                  on
                    ? 'inline-block rounded-full border border-teal-600 bg-teal-600 px-3 py-1 text-xs font-medium text-white'
                    : 'inline-block rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-teal-500 hover:text-teal-700'
                }
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
            <span className="ml-1 text-xs font-normal text-slate-500">(1인 성인 · 예약가능 {selected.departures.length}회)</span>
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-3 md:grid-cols-4">
            {deps.map((d) => (
              <li key={d.ymd} className="flex justify-between gap-2">
                <span>{formatYmdKo(d.ymd)}</span>
                <span className="font-medium">{won(d.priceKrw)}</span>
              </li>
            ))}
          </ul>
          {selected.departures.length > DEPARTURES_PREVIEW ? (
            <button type="button" className="mt-2 text-xs text-teal-700 underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '접기' : `출발일 ${selected.departures.length - DEPARTURES_PREVIEW}개 더보기`}
            </button>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">아래 달력에서 위 날짜를 선택해 예약하세요. 가격은 성인 1인 기준입니다.</p>
        </div>
      ) : null}
    </section>
  )
}
