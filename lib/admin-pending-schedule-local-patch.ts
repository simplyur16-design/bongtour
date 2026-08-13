/**
 * 등록대기 사진 수급 — schedule JSON 로컬 패치 (전체 product GET 생략용).
 * REGRESSION-FREEZE[admin-pending-photo-register-local-patch]: keyword/apply 후 full refetch 금지 — manifest
 */
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'

export type ScheduleDayPatch = Record<string, unknown>

/** day 행만 병합해 schedule JSON 문자열을 갱신. 파싱 실패 시 null. */
export function patchProductScheduleJsonDay(
  scheduleJson: string | null | undefined,
  day: number,
  patch: ScheduleDayPatch,
): string | null {
  if (!Number.isInteger(day) || day < 1) return null
  let rows: Array<Record<string, unknown>> = []
  try {
    const parsed = JSON.parse(scheduleJson ?? '[]') as unknown
    rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : []
  } catch {
    return null
  }
  let found = false
  const next = rows.map((row) => {
    if (Number(row.day) !== day) return row
    found = true
    return { ...row, ...patch, day }
  })
  if (!found) {
    next.push({ day, title: `DAY ${day}`, description: '', ...patch })
  }
  next.sort((a, b) => Number(a.day ?? 0) - Number(b.day ?? 0))
  return JSON.stringify(next)
}

/**
 * 표시용 키워드 — DB에 저장된 값이 있으면 재파생(derive)보다 우선.
 * 사진 수급 단계에서 수동 저장 키워드가 매 렌더마다 덮이지 않게 함.
 * 대소만 다른 저장값은 유지. Hollywood Road → Hong Kong 등 geo 확정만 finalize.
 */
export function preferStoredScheduleImageKeyword(
  stored: string | null | undefined,
  derived: string | null | undefined,
): string {
  const s = String(stored ?? '').trim()
  if (s) {
    try {
      const finalized = finalizeScheduleImageKeyword(s)
      // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 저장 Hollywood Road ≠ LA — manifest
      if (finalized && finalized.toLowerCase() !== s.toLowerCase()) return finalized
    } catch {
      /* keep stored */
    }
    return s
  }
  return String(derived ?? '').trim()
}
