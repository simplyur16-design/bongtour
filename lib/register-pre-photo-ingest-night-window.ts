/**
 * 신규등록 ingest 시각 — KST 22:00 포함 ~ 10:00 미만.
 * 창 동안 공급사당 3건을 채울 때까지 이어 돈다. 한 시각에 한 번 끊지 않는다.
 * 이미 큐에 등록대기가 있어도(예: 12건) 오늘 할당량을 채운 것으로 보지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 · 할당량까지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: 창 동안 할당량까지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 */
import { addDaysUtcYmd } from '@/lib/calendar-ymd'
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER } from '@/lib/register-pre-photo-ingest-geo-slots'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 저녁 10시(포함) */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_START_HOUR = 22
/** 오전 10시(미포함) */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_END_HOUR = 10
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES = 12 * 60

export const REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING = '* 22-23 * * *'
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING = '* 0-9 * * *'

/** 운영 4사 × 하루 3건. 큐 leftover와 무관하게 매일 밤 이만큼 새로 받는다. */
export const REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL =
  REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER * 4

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

/** 창 시작(KST 22:00)의 UTC. 그 시각 이후 등록대기만 오늘 할당량으로 센다. */
export function registerPrePhotoIngestNightWindowStartUtc(windowId: string): Date {
  return new Date(`${windowId}T13:00:00.000Z`)
}

export function shouldRunRegisterPrePhotoIngestNightTick(
  now: Date,
  nightQuotaFilled: boolean,
): boolean {
  const windowId = registerPrePhotoIngestNightWindowId(now)
  if (!windowId) return false
  if (nightQuotaFilled) return false
  return minutesIntoRegisterPrePhotoIngestNightWindow(now) != null
}

/**
 * 오늘 밤 창에 새로 만든 pending만 센다.
 * 어제부터 쌓인 등록대기 수는 넣지 않는다 — leftover 12건이 있어도 false.
 */
export function createdTonightFillsRegisterPrePhotoIngestQuota(
  createdTonightBySupplier: Readonly<Record<string, number>>,
  perSupplier: number = REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
): boolean {
  return pickNextRegisterPrePhotoIngestNightSupplier(createdTonightBySupplier, perSupplier) == null
}

export function pickNextRegisterPrePhotoIngestNightSupplier(
  createdBySupplier: Readonly<Record<string, number>>,
  perSupplier: number = REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
): CanonicalOverseasSupplierKey | null {
  for (const supplier of CANONICAL_OVERSEAS_SUPPLIER_KEYS) {
    if ((createdBySupplier[supplier] ?? 0) < perSupplier) return supplier
  }
  return null
}

export function remainingRegisterPrePhotoIngestTonight(
  createdBySupplier: Readonly<Record<string, number>>,
  supplier: CanonicalOverseasSupplierKey,
  perSupplier: number = REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
): number {
  return Math.max(0, perSupplier - (createdBySupplier[supplier] ?? 0))
}

/** 한 공급사를 빈손으로 끝낸 뒤 바로 다시 치지 않는다. */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_SUPPLIER_COOLDOWN_MS = 20 * 60 * 1000

export function pickNextRegisterPrePhotoIngestNightSupplierAfterCooldown(
  createdBySupplier: Readonly<Record<string, number>>,
  lastAttemptAtMs: Readonly<Record<string, number>>,
  nowMs: number,
  cooldownMs: number = REGISTER_PRE_PHOTO_INGEST_NIGHT_SUPPLIER_COOLDOWN_MS,
  perSupplier: number = REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
): CanonicalOverseasSupplierKey | null {
  for (const supplier of CANONICAL_OVERSEAS_SUPPLIER_KEYS) {
    if ((createdBySupplier[supplier] ?? 0) >= perSupplier) continue
    const last = lastAttemptAtMs[supplier] ?? 0
    if (last > 0 && nowMs - last < cooldownMs) continue
    return supplier
  }
  return null
}
