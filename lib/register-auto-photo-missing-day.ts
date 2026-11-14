/**
 * 대표 사진은 두고, 당일 장소 키워드가 있는 빈 일차만 채운다.
 * REGRESSION-FREEZE[auto-photo-missing-day-fill]: missing-day-only — manifest
 */
import { isRegisterScheduleNoPlacePhotoDay } from '@/lib/register-schedule-day-summary-finalize'
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'

export type MissingDaySlot = {
  day: number
  title?: string | null
  routeText?: string | null
  hotelText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
}

export type MissingDayFillAction = 'keep' | 'fill' | 'skip'

function dayNum(day: MissingDaySlot, index: number): number {
  const n = Math.floor(Number(day.day))
  return Number.isFinite(n) && n > 0 ? n : index + 1
}

export function missingDayFillAction(day: MissingDaySlot, maxDay: number): MissingDayFillAction {
  if (String(day.imageUrl ?? '').trim()) return 'keep'
  if (isRegisterScheduleNoPlacePhotoDay(day, maxDay)) return 'skip'
  if (registerScheduleDayIsCityOnlyPhotoSkip(day)) return 'skip'
  if (!String(day.imageKeyword ?? '').trim()) return 'skip'
  return 'fill'
}

export function secondarySlotNeedsFill(day: MissingDaySlot, maxDay: number): boolean {
  if (isRegisterScheduleNoPlacePhotoDay(day, maxDay)) return false
  if (registerScheduleDayIsCityOnlyPhotoSkip(day)) return false
  if (!String(day.imageKeyword2 ?? '').trim()) return false
  return !String(day.imageUrl2 ?? '').trim()
}

export function parseScheduleMissingDaySlots(schedule: string | null): MissingDaySlot[] {
  if (!schedule?.trim()) return []
  try {
    const v = JSON.parse(schedule) as unknown
    if (!Array.isArray(v)) return []
    const out: MissingDaySlot[] = []
    for (const item of v) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const day = Math.floor(Number(row.day))
      if (!Number.isFinite(day) || day < 1) continue
      out.push({
        day,
        title: typeof row.title === 'string' ? row.title : null,
        routeText: typeof row.routeText === 'string' ? row.routeText : null,
        hotelText: typeof row.hotelText === 'string' ? row.hotelText : null,
        imageKeyword: typeof row.imageKeyword === 'string' ? row.imageKeyword : null,
        imageKeyword2: typeof row.imageKeyword2 === 'string' ? row.imageKeyword2 : null,
        imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
        imageUrl2: typeof row.imageUrl2 === 'string' ? row.imageUrl2 : null,
      })
    }
    return out
  } catch {
    return []
  }
}

/** 사진 대상 일차 중 비어 있는 primary 또는 secondary 가 있으면 true */
export function scheduleHasMissingEligiblePhotoSlot(schedule: string | null): boolean {
  const days = parseScheduleMissingDaySlots(schedule)
  const maxDay = days.reduce((m, d, i) => Math.max(m, dayNum(d, i)), 0)
  return days.some((d, i) => {
    const max = maxDay || dayNum(d, i)
    return missingDayFillAction(d, max) === 'fill' || secondarySlotNeedsFill(d, max)
  })
}

/**
 * 키워드가 겹치면 풀 5장을 일차 순서대로 덮어쓴다. 빈 칸만 채울 때, 또는 이미 사진이 있으면 그 경로를 타지 않는다.
 * REGRESSION-FREEZE[photo-fill-route-sight-1114]: 일괄 배정은 빈 상품만 — manifest
 */
export function shouldBulkAssignUndistinctPool(input: {
  poolCount: number
  fillMissingOnly: boolean
  storedDayPhotoCount: number
}): boolean {
  if (input.fillMissingOnly || input.storedDayPhotoCount > 0) return false
  return input.poolCount >= 5
}

export function countNewlyFilledPhotoSlots(input: {
  beforeDayUrls: ReadonlyArray<string | null | undefined>
  afterDayUrls: ReadonlyArray<string | null | undefined>
  beforeCover?: string | null
  afterCover?: string | null
  coverCounts: boolean
}): number {
  let n = 0
  const len = Math.max(input.beforeDayUrls.length, input.afterDayUrls.length)
  for (let i = 0; i < len; i++) {
    if (!String(input.beforeDayUrls[i] ?? '').trim() && String(input.afterDayUrls[i] ?? '').trim()) n++
  }
  if (input.coverCounts && !String(input.beforeCover ?? '').trim() && String(input.afterCover ?? '').trim()) n++
  return n
}

/** 실제로 채운 칸이 0이면 성공이 아니다. */
export function photoFillHttpResult(filled: number): {
  httpStatus: number
  body: { success: boolean; filled: number; reason?: string }
} {
  if (filled > 0) return { httpStatus: 200, body: { success: true, filled } }
  return { httpStatus: 422, body: { success: false, filled: 0, reason: 'no_slot_filled' } }
}

export function autoPhotoFillRequest(hasMainPhoto: boolean): {
  photoChain: 'v2'
  preserveHero: boolean
  fillMissingOnly: true
} {
  return { photoChain: 'v2', preserveHero: hasMainPhoto, fillMissingOnly: true }
}

/** preserveHero 이면 대표 URL·출처 칸은 갱신하지 않는다 */
export function processImagesProductUpdate(
  preserveHero: boolean,
  schedule: string,
  bg: Record<string, unknown>,
): Record<string, unknown> {
  if (preserveHero) return { schedule }
  return { schedule, ...bg }
}
