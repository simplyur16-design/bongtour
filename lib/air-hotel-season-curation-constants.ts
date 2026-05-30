import { addMonthsToMonthKey } from '@/lib/monthly-curation-auto'

export const AIR_HOTEL_SEASON_CARD_COUNTS = {
  plus1: 3,
  plus2: 3,
  plus3: 5,
} as const

export const AIR_HOTEL_SEASON_TOTAL_CARDS =
  AIR_HOTEL_SEASON_CARD_COUNTS.plus1 +
  AIR_HOTEL_SEASON_CARD_COUNTS.plus2 +
  AIR_HOTEL_SEASON_CARD_COUNTS.plus3

/** Gemini 선정 후보 풀 — updatedAt desc 상위 N개 */
export const AIR_HOTEL_SEASON_POOL_SIZE = 30

const YM_RE = /^\d{4}-\d{2}$/

function getKstYmdParts(d: Date): { y: number; m: number; day: number } {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  const [y, mo, day] = s.split('-').map((x) => parseInt(x, 10)) as [number, number, number]
  return { y, m: mo, day }
}

/** KST 매월 25일 00:00 — cycle 시작 시각. */
export function getAirHotelCycleStartDate(cycleId: string): Date {
  if (!YM_RE.test(cycleId)) {
    throw new Error(`Invalid cycleId: ${cycleId}`)
  }
  return new Date(`${cycleId}-25T00:00:00+09:00`)
}

/**
 * KST 기준 25일 이전 → 전월 cycle, 25일 이후(포함) → 당월 cycle.
 * 예: 5/25~6/24 → cycleId='2026-05', 노출월 6·7·8.
 */
export function getAirHotelCycleIdForNow(now: Date = new Date()): string {
  const { y, m, day } = getKstYmdParts(now)
  let cycleY = y
  let cycleM = m
  if (day < 25) {
    cycleM -= 1
    if (cycleM < 1) {
      cycleM = 12
      cycleY -= 1
    }
  }
  return `${cycleY}-${String(cycleM).padStart(2, '0')}`
}

/** cycleId(YYYY-MM) 기준 +1·+2·+3 monthKey. 예: '2026-05' → ['2026-06','2026-07','2026-08']. */
export function getAirHotelExposureMonthKeys(cycleId: string): string[] {
  if (!YM_RE.test(cycleId)) {
    throw new Error(`Invalid cycleId: ${cycleId}`)
  }
  return [
    addMonthsToMonthKey(cycleId, 1),
    addMonthsToMonthKey(cycleId, 2),
    addMonthsToMonthKey(cycleId, 3),
  ]
}
