/**
 * 국외연수 — 고정 출발 요일 기준 1년 달력·예시 일정 날짜 매핑.
 * 0=일 … 6=토 (Product.fixedDepartureWeekday 와 동일).
 */

import { addMonths, compareYmd, daysInMonth, parseYmdLocal, toYmd, weekdayOfFirstOfMonth } from '@/lib/bongsim/trip-calendar-utils'

export type TrainingDepartureCalendarRange = {
  startYmd: string
  endYmd: string
}

/** 오늘(KST 로컬)부터 1년 — 달력 표시 범위 */
export function defaultTrainingDepartureCalendarRange(now = new Date()): TrainingDepartureCalendarRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + 1)
  end.setDate(end.getDate() - 1)
  return { startYmd: toYmd(start), endYmd: toYmd(end) }
}

export function isValidTrainingDepartureWeekday(weekday: number | null | undefined): weekday is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return weekday != null && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
}

export function isTrainingDepartureYmd(ymd: string, fixedDepartureWeekday: number): boolean {
  const d = parseYmdLocal(ymd)
  if (!d) return false
  return d.getDay() === fixedDepartureWeekday
}

/** 범위 내 출발일 YMD 목록 (오름차순) */
export function listTrainingDepartureYmdInRange(
  fixedDepartureWeekday: number,
  range: TrainingDepartureCalendarRange
): string[] {
  if (!isValidTrainingDepartureWeekday(fixedDepartureWeekday)) return []
  const start = parseYmdLocal(range.startYmd)
  const end = parseYmdLocal(range.endYmd)
  if (!start || !end || compareYmd(range.startYmd, range.endYmd) > 0) return []

  const out: string[] = []
  const cur = new Date(start)
  while (compareYmd(toYmd(cur), range.endYmd) <= 0) {
    if (cur.getDay() === fixedDepartureWeekday) {
      out.push(toYmd(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/** 클릭일이 출발 요일이 아니면 해당 주의 다음 출발일(범위 내)로 보정 */
export function normalizeTrainingDepartureYmd(
  ymd: string,
  fixedDepartureWeekday: number,
  range: TrainingDepartureCalendarRange
): string | null {
  if (!isValidTrainingDepartureWeekday(fixedDepartureWeekday)) return null
  const d = parseYmdLocal(ymd)
  if (!d) return null

  let cur = new Date(d)
  if (cur.getDay() !== fixedDepartureWeekday) {
    const diff = (fixedDepartureWeekday - cur.getDay() + 7) % 7
    cur.setDate(cur.getDate() + diff)
  }
  const normalized = toYmd(cur)
  if (compareYmd(normalized, range.startYmd) < 0) {
    const list = listTrainingDepartureYmdInRange(fixedDepartureWeekday, range)
    return list[0] ?? null
  }
  if (compareYmd(normalized, range.endYmd) > 0) {
    const list = listTrainingDepartureYmdInRange(fixedDepartureWeekday, range)
    return list[list.length - 1] ?? null
  }
  return normalized
}

/** 출발일 + 일차(1-based) → 캘린더 YMD */
export function trainingScheduleDayYmd(departureYmd: string, dayNumber: number): string | null {
  const dep = parseYmdLocal(departureYmd)
  if (!dep || !Number.isFinite(dayNumber) || dayNumber < 1) return null
  const d = new Date(dep)
  d.setDate(d.getDate() + Math.floor(dayNumber) - 1)
  return toYmd(d)
}

const MONTH_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'] as const
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const

/** `6월 1일 (월)` */
export function formatTrainingCalendarDayLabel(ymd: string): string {
  const d = parseYmdLocal(ymd)
  if (!d) return ymd
  const m = MONTH_KO[d.getMonth()] ?? `${d.getMonth() + 1}월`
  const w = WEEKDAY_SHORT[d.getDay()] ?? ''
  return `${m} ${d.getDate()}일 (${w})`
}

export type TrainingCalendarMonthGrid = {
  year: number
  monthIndex: number
  label: string
  cells: ({ ymd: string; isDeparture: boolean; inRange: boolean } | null)[]
}

export function buildTrainingYearCalendarMonths(
  fixedDepartureWeekday: number,
  range: TrainingDepartureCalendarRange
): TrainingCalendarMonthGrid[] {
  const departureSet = new Set(listTrainingDepartureYmdInRange(fixedDepartureWeekday, range))
  const start = parseYmdLocal(range.startYmd)
  const end = parseYmdLocal(range.endYmd)
  if (!start || !end) return []

  const months: TrainingCalendarMonthGrid[] = []
  let y = start.getFullYear()
  let m = start.getMonth()
  const endY = end.getFullYear()
  const endM = end.getMonth()

  while (y < endY || (y === endY && m <= endM)) {
    const dim = daysInMonth(y, m)
    const pad = weekdayOfFirstOfMonth(y, m)
    const cells: TrainingCalendarMonthGrid['cells'] = []
    for (let i = 0; i < pad; i++) cells.push(null)
    for (let d = 1; d <= dim; d++) {
      const ymd = toYmd(new Date(y, m, d))
      const inRange = compareYmd(ymd, range.startYmd) >= 0 && compareYmd(ymd, range.endYmd) <= 0
      cells.push({
        ymd,
        inRange,
        isDeparture: inRange && departureSet.has(ymd),
      })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    months.push({
      year: y,
      monthIndex: m,
      label: `${y}년 ${m + 1}월`,
      cells,
    })

    const next = addMonths(y, m, 1)
    y = next.y
    m = next.m
  }

  return months
}

export function pickDefaultTrainingDepartureYmd(
  fixedDepartureWeekday: number,
  range: TrainingDepartureCalendarRange
): string | null {
  const list = listTrainingDepartureYmdInRange(fixedDepartureWeekday, range)
  return list[0] ?? null
}
