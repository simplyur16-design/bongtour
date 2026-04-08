'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import {
  buildDepartureViewModels,
  formatDeparturePrice,
  globalLowestBookable,
  minBookablePriceByMonth,
  type DeparturePriceViewModel,
} from '@/lib/departure-price-view-model'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoFromYmd(y: number, m0: number, day: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(day)}`
}

function parseYmFromIso(iso: string): { y: number; m0: number } {
  const [ys, ms] = iso.slice(0, 10).split('-')
  return { y: Number(ys), m0: Number(ms) - 1 }
}

type Props = {
  open: boolean
  onClose: () => void
  prices: ProductPriceRow[]
  originSource: string
  selectedDate: string | null
  onSelectDate: (isoDate: string) => void
  /** 모바일: 목록 우선 */
  listFirst?: boolean
}

export default function DepartureDatePickerModal({
  open,
  onClose,
  prices,
  originSource,
  selectedDate,
  onSelectDate,
  listFirst = false,
}: Props) {
  const viewModels = useMemo(
    () => buildDepartureViewModels(prices, originSource),
    [prices, originSource]
  )

  const byDate = useMemo(() => {
    const m: Record<string, DeparturePriceViewModel> = {}
    for (const v of viewModels) m[v.departureDate] = v
    return m
  }, [viewModels])

  const minByMonth = useMemo(() => minBookablePriceByMonth(viewModels), [viewModels])
  const globalLow = useMemo(() => globalLowestBookable(viewModels), [viewModels])

  const initialCursor = useMemo(() => {
    const pick = selectedDate ?? viewModels[0]?.departureDate
    if (pick) return parseYmFromIso(pick)
    const t = new Date()
    return { y: t.getFullYear(), m0: t.getMonth() }
  }, [selectedDate, viewModels])

  const [cursor, setCursor] = useState(initialCursor)

  useEffect(() => {
    if (!open) return
    setCursor(initialCursor)
  }, [open, initialCursor])

  const dim = useMemo(
    () => new Date(cursor.y, cursor.m0 + 1, 0).getDate(),
    [cursor.y, cursor.m0]
  )
  const leadBlank = useMemo(() => new Date(cursor.y, cursor.m0, 1).getDay(), [cursor.y, cursor.m0])
  const monthLabel = `${cursor.y}년 ${cursor.m0 + 1}월`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || viewModels.length === 0 || !globalLow) return null

  const pick = (iso: string) => {
    onSelectDate(iso)
    onClose()
  }

  const calendar = (
    <DepartureCalendarBlock
      cursor={cursor}
      setCursor={setCursor}
      monthLabel={monthLabel}
      dim={dim}
      leadBlank={leadBlank}
      byDate={byDate}
      minByMonth={minByMonth}
      globalLow={globalLow}
      selectedDate={selectedDate}
      onSelectDate={pick}
    />
  )

  const list = (
    <DepartureListBlock
      viewModels={viewModels}
      selectedDate={selectedDate}
      onSelectDate={pick}
      minByMonth={minByMonth}
    />
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-bt-border-strong bg-bt-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bt-border-soft px-4 py-3">
          <h2 id="departure-modal-title" className="text-base font-bold text-bt-title">
            출발일 선택
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-bt-muted hover:bg-bt-border-soft"
          >
            닫기
          </button>
        </div>
        <p className="border-b border-bt-border-soft px-4 py-2 text-xs text-bt-muted">
          날짜를 누르면 견적이 바로 반영됩니다. 미표시 날은 미운영·데이터 없음입니다.
        </p>
        <div className="overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {listFirst ? (
              <>
                {list}
                <div className="rounded-2xl border-2 border-bt-brand-blue-strong/30 bg-bt-surface p-3 shadow-inner">{calendar}</div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border-2 border-bt-brand-blue-strong/30 bg-bt-surface p-3 shadow-inner">{calendar}</div>
                {list}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DepartureCalendarBlock({
  cursor,
  setCursor,
  monthLabel,
  dim,
  leadBlank,
  byDate,
  minByMonth,
  globalLow,
  selectedDate,
  onSelectDate,
}: {
  cursor: { y: number; m0: number }
  setCursor: Dispatch<SetStateAction<{ y: number; m0: number }>>
  monthLabel: string
  dim: number
  leadBlank: number
  byDate: Record<string, DeparturePriceViewModel>
  minByMonth: Record<string, number>
  globalLow: DeparturePriceViewModel
  selectedDate: string | null
  onSelectDate: (iso: string) => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            setCursor((c) => {
              const nm = c.m0 - 1
              if (nm < 0) return { y: c.y - 1, m0: 11 }
              return { y: c.y, m0: nm }
            })
          }
          className="rounded-lg border border-bt-border px-3 py-2 text-sm font-semibold text-bt-title hover:bg-bt-page"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="text-base font-bold text-bt-title">{monthLabel}</span>
        <button
          type="button"
          onClick={() =>
            setCursor((c) => {
              const nm = c.m0 + 1
              if (nm > 11) return { y: c.y + 1, m0: 0 }
              return { y: c.y, m0: nm }
            })
          }
          className="rounded-lg border border-bt-border px-3 py-2 text-sm font-semibold text-bt-title hover:bg-bt-page"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-bt-muted sm:text-xs">
        {WEEKDAY.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
        {Array.from({ length: leadBlank }).map((_, i) => (
          <div key={`b-${i}`} />
        ))}
        {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
          const iso = isoFromYmd(cursor.y, cursor.m0, day)
          const vm = byDate[iso]
          const inData = Boolean(vm)
          const bookable = vm?.isAvailable ?? false
          const isSel = selectedDate === iso
          const monthKey = iso.slice(0, 7)
          const isLowMonth =
            bookable && vm.price != null && minByMonth[monthKey] != null && vm.price === minByMonth[monthKey]
          const isLowGlobal = bookable && globalLow?.departureDate === iso

          if (!inData) {
            return (
              <div
                key={iso}
                className="flex min-h-[52px] flex-col items-center justify-center rounded-lg border border-transparent py-1 text-bt-disabled sm:min-h-[56px]"
              >
                <span className="text-bt-disabled">{day}</span>
              </div>
            )
          }

          if (!bookable) {
            return (
              <div
                key={iso}
                className="flex min-h-[52px] flex-col items-center justify-center rounded-lg border border-bt-cal-unavailable/80 bg-bt-surface-soft py-1 sm:min-h-[56px]"
              >
                <span className="text-bt-meta">{day}</span>
                <span className="mt-0.5 text-[10px] font-medium text-bt-disabled">미운영</span>
              </div>
            )
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg border py-1 transition sm:min-h-[56px] ${
                isSel
                  ? 'border-bt-cal-selected bg-bt-brand-blue-soft ring-2 ring-bt-cal-selected/40'
                  : 'border-bt-border-soft bg-white hover:border-bt-link/50'
              }`}
            >
              <span className="text-xs font-medium text-bt-muted">{day}</span>
              <span className="mt-0.5 text-[11px] font-bold text-bt-cal-available sm:text-xs">
                {formatDeparturePrice(vm)}
              </span>
              <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                {isLowMonth ? (
                  <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold text-emerald-900 sm:text-[10px]">
                    이달 최저
                  </span>
                ) : null}
                {isLowGlobal ? (
                  <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-900 sm:text-[10px]">
                    원최저가
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DepartureListBlock({
  viewModels,
  selectedDate,
  onSelectDate,
  minByMonth,
}: {
  viewModels: DeparturePriceViewModel[]
  selectedDate: string | null
  onSelectDate: (iso: string) => void
  minByMonth: Record<string, number>
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-bt-title">날짜별 요금</h3>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-bt-border-strong bg-bt-surface shadow-inner sm:max-h-72">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="sticky top-0 bg-bt-disclosure text-bt-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">출발일</th>
              <th className="px-3 py-2.5 font-semibold">상태</th>
              <th className="px-3 py-2.5 text-right font-semibold">성인(참고)</th>
            </tr>
          </thead>
          <tbody>
            {viewModels.map((vm) => {
              const isSel = selectedDate === vm.departureDate
              const monthKey = vm.departureDate.slice(0, 7)
              const lowMonth =
                vm.isAvailable &&
                vm.price != null &&
                minByMonth[monthKey] != null &&
                vm.price === minByMonth[monthKey]
              return (
                <tr
                  key={vm.sourceRowId}
                  className={`border-t border-bt-border ${isSel ? 'bg-bt-accent-subtle/60' : ''} ${!vm.isAvailable ? 'text-bt-disabled' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      disabled={!vm.isAvailable}
                      onClick={() => vm.isAvailable && onSelectDate(vm.departureDate)}
                      className={`text-left ${vm.isAvailable ? 'font-semibold text-bt-body hover:text-bt-link' : 'cursor-default text-bt-disabled'}`}
                    >
                      {vm.departureDate}{' '}
                      <span className="text-bt-muted">({WEEKDAY[new Date(vm.departureDate).getDay()]})</span>
                      {lowMonth && vm.isAvailable ? (
                        <span className="ml-1 text-[10px] font-bold text-emerald-800">이달 최저가</span>
                      ) : null}
                    </button>
                    {vm.seatStatus ? <div className="text-[10px] text-bt-meta">{vm.seatStatus}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-bt-meta">{vm.statusLabel}</td>
                  <td className="px-3 py-2.5 text-right">
                    {vm.isAvailable && vm.price != null ? (
                      <span className="font-bold text-bt-price">{formatDeparturePrice(vm)}</span>
                    ) : (
                      <span className="text-bt-disabled">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
