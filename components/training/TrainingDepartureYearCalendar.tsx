'use client'

import { useMemo } from 'react'
import {
  buildTrainingYearCalendarMonths,
  defaultTrainingDepartureCalendarRange,
  formatTrainingCalendarDayLabel,
  isValidTrainingDepartureWeekday,
  normalizeTrainingDepartureYmd,
  type TrainingDepartureCalendarRange,
} from '@/lib/overseas-training-departure-calendar'

const WEEK_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

type Props = {
  fixedDepartureWeekday: number | null | undefined
  selectedYmd: string | null
  onSelectYmd: (ymd: string) => void
  range?: TrainingDepartureCalendarRange
}

export default function TrainingDepartureYearCalendar({
  fixedDepartureWeekday,
  selectedYmd,
  onSelectYmd,
  range: rangeProp,
}: Props) {
  const range = rangeProp ?? defaultTrainingDepartureCalendarRange()

  const months = useMemo(() => {
    if (!isValidTrainingDepartureWeekday(fixedDepartureWeekday)) return []
    return buildTrainingYearCalendarMonths(fixedDepartureWeekday, range)
  }, [fixedDepartureWeekday, range])

  if (!isValidTrainingDepartureWeekday(fixedDepartureWeekday)) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        출발 요일이 등록되면 1년 달력에서 예시 출발일을 선택할 수 있습니다.
      </p>
    )
  }

  const handlePick = (ymd: string, inRange: boolean, isDeparture: boolean) => {
    if (!inRange) return
    const normalized = normalizeTrainingDepartureYmd(ymd, fixedDepartureWeekday, range)
    if (normalized) onSelectYmd(normalized)
    else if (isDeparture) onSelectYmd(ymd)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">예시 출발일 선택</p>
        <p className="mt-1 text-emerald-900/90">
          {WEEK_KR[fixedDepartureWeekday]}요일 출발 기준으로 1년간 선택할 수 있습니다. 날짜를 누르면 해당 주기의
          예시 일정이 아래에 표시됩니다.
        </p>
        {selectedYmd ? (
          <p className="mt-2 font-medium text-emerald-950">
            선택: {formatTrainingCalendarDayLabel(selectedYmd)} 출발
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => (
          <div
            key={`${month.year}-${month.monthIndex}`}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <p className="text-center text-sm font-bold text-slate-900">{month.label}</p>
            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-500">
              {WEEK_KR.map((w) => (
                <div key={w} className="py-0.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {month.cells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`e-${month.year}-${month.monthIndex}-${idx}`} className="aspect-square min-h-[1.6rem]" />
                }
                const dnum = parseInt(cell.ymd.slice(8), 10)
                const isSelected = selectedYmd === cell.ymd
                const base =
                  'flex aspect-square min-h-[1.6rem] w-full items-center justify-center rounded-md text-[11px] font-semibold transition'

                if (!cell.inRange) {
                  return (
                    <div key={cell.ymd} className={`${base} text-slate-300`}>
                      {dnum}
                    </div>
                  )
                }

                if (!cell.isDeparture) {
                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      onClick={() => handlePick(cell.ymd, cell.inRange, cell.isDeparture)}
                      className={`${base} text-slate-400 hover:bg-slate-100 hover:text-slate-600`}
                      title="출발 요일이 아닙니다 — 가장 가까운 출발일로 맞춥니다"
                    >
                      {dnum}
                    </button>
                  )
                }

                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    onClick={() => onSelectYmd(cell.ymd)}
                    className={`${base} ${
                      isSelected
                        ? 'bg-slate-900 text-white ring-2 ring-slate-400'
                        : 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200'
                    }`}
                    aria-pressed={isSelected}
                    aria-label={`${formatTrainingCalendarDayLabel(cell.ymd)} 출발`}
                  >
                    {dnum}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
