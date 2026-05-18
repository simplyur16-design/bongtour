/**
 * 해외 허브 히어로·시즌 Gemini — 슬롯별 노출 월(서울 기준 +1·+2·+3) SSOT.
 * 생성 달(사이클 달)에는 추천하지 않음. 5월 생성 → 6·7·8월 여행 추천이 섞여 노출.
 */
import { publicPageHeroMonthPlus } from '@/lib/public-page-hero-editorial-line'

/** 5슬롯 — +1·+2·+3월(및 +1·+2 반복) — 현재 달(0) 미포함 */
export const SEASON_HERO_SLOT_MONTH_OFFSETS = [1, 2, 3, 1, 2] as const

export function seasonHeroTargetMonthForSlotIndex(
  baseMonth1To12: number,
  slotIndex: number,
): number {
  const offset = SEASON_HERO_SLOT_MONTH_OFFSETS[slotIndex % SEASON_HERO_SLOT_MONTH_OFFSETS.length]!
  return publicPageHeroMonthPlus(baseMonth1To12, offset)
}

/** Gemini primary 5도시 순서대로 배정 월(1~12, 생성 달 기준 +오프셋) */
export function seasonHeroTargetMonthsForBase(baseMonth1To12: number): number[] {
  return SEASON_HERO_SLOT_MONTH_OFFSETS.map((o) => publicPageHeroMonthPlus(baseMonth1To12, o))
}

/** 사이클 시작일(KST 달) → 생성 달. 없으면 fallback */
export function seasonHeroBaseMonthFromCycleStart(
  cycleStartDate: Date | string | null | undefined,
  fallbackMonth1To12: number,
): number {
  if (!cycleStartDate) return fallbackMonth1To12
  const d = typeof cycleStartDate === 'string' ? new Date(cycleStartDate) : cycleStartDate
  if (Number.isNaN(d.getTime())) return fallbackMonth1To12
  const m = parseInt(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(d),
    10,
  )
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : fallbackMonth1To12
}

/** reasoning·서브라인이 해당 월 기준인지 드러나게 */
export function sublineWithTargetMonth(targetMonth1To12: number, raw: string): string {
  const t = raw.trim()
  if (!t) return `${targetMonth1To12}월`
  if (new RegExp(`^${targetMonth1To12}\\s*월`).test(t)) return t
  return `${targetMonth1To12}월 · ${t}`
}
