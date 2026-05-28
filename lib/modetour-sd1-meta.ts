/** Product.rawMeta — modetour SD1 연속 400 streak (schema 변경 없음). */

import { MODETOUR_SD1_RETIRE_STREAK } from '@/lib/modetour-sd1-policy'

export const MODETOUR_SD1_RAW_META_STREAK_KEY = 'modetourNotFoundStreak'

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseModetourNotFoundStreak(rawMeta: string | null | undefined): number {
  const v = parseRawMetaObject(rawMeta)[MODETOUR_SD1_RAW_META_STREAK_KEY]
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  return 0
}

export function mergeModetourNotFoundStreakIntoRawMeta(
  rawMeta: string | null | undefined,
  streak: number
): string {
  const base = parseRawMetaObject(rawMeta)
  const n = Math.max(0, Math.floor(streak))
  if (n <= 0) {
    delete base[MODETOUR_SD1_RAW_META_STREAK_KEY]
  } else {
    base[MODETOUR_SD1_RAW_META_STREAK_KEY] = n
  }
  return JSON.stringify(base)
}

export function bumpModetourNotFoundStreak(
  rawMeta: string | null | undefined,
  delta = 1
): { nextRawMeta: string; streak: number } {
  const streak = parseModetourNotFoundStreak(rawMeta) + Math.max(0, Math.floor(delta))
  return { nextRawMeta: mergeModetourNotFoundStreakIntoRawMeta(rawMeta, streak), streak }
}

export function resetModetourNotFoundStreak(rawMeta: string | null | undefined): string {
  return mergeModetourNotFoundStreakIntoRawMeta(rawMeta, 0)
}

export function modetourSd1StreakReachedRetire(streak: number): boolean {
  return streak >= MODETOUR_SD1_RETIRE_STREAK
}
