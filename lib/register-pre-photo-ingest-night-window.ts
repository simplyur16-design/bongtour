/**
 * 신규등록 ingest 시각 — KST 22:00 포함 ~ 10:00 미만, 날짜마다 다른 분.
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 — manifest
 */
import { addDaysUtcYmd } from '@/lib/calendar-ymd'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 저녁 10시(포함) */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR = 22
/** 오전 10시(미포함) */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_END_HOUR = 10
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES = 12 * 60

export const REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING = '* 22-23 * * *'
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING = '* 0-9 * * *'

export type RegisterPrePhotoKstClock = {
  ymd: string
  hour: number
  minute: number
}

export function kstClockFromUtc(now: Date): RegisterPrePhotoKstClock {
  const iso = new Date(now.getTime() + KST_OFFSET_MS).toISOString()
  return {
    ymd: iso.slice(0, 10),
    hour: Number(iso.slice(11, 13)),
    minute: Number(iso.slice(14, 16)),
  }
}

/** 창 시작일(저녁 날짜). 낮 시간은 null. */
export function registerPrePhotoIngestNightWindowId(now: Date): string | null {
  const { ymd, hour } = kstClockFromUtc(now)
  if (hour >= REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR) return ymd
  if (hour < REGISTER_PRE_PHOTO_INGEST_NIGHT_END_HOUR) return addDaysUtcYmd(ymd, -1)
  return null
}

export function minutesIntoRegisterPrePhotoIngestNightWindow(now: Date): number | null {
  const { hour, minute } = kstClockFromUtc(now)
  if (hour >= REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR) {
    return (hour - REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR) * 60 + minute
  }
  if (hour < REGISTER_PRE_PHOTO_INGEST_NIGHT_END_HOUR) {
    return (hour + 24 - REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR) * 60 + minute
  }
  return null
}

export function registerPrePhotoIngestNightTargetMinuteOffset(windowId: string): number {
  let h = 2166136261
  for (let i = 0; i < windowId.length; i++) {
    h ^= windowId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES
}

export function shouldRunRegisterPrePhotoIngestNightTick(
  now: Date,
  alreadyRanWindowId: string | null,
): boolean {
  const windowId = registerPrePhotoIngestNightWindowId(now)
  if (!windowId) return false
  if (alreadyRanWindowId === windowId) return false
  const elapsed = minutesIntoRegisterPrePhotoIngestNightWindow(now)
  if (elapsed == null) return false
  return elapsed >= registerPrePhotoIngestNightTargetMinuteOffset(windowId)
}
