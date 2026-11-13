/**
 * 사진 단계 등 schedule JSON 을 다시 쓰는 경로에서 등록 때 저장한 일차 원문 근거를 잃지 않게 한다.
 * 새 행에 값이 없을(null·빈 문자열·키 없음) 때만 저장돼 있던 값을 그대로 옮긴다. 이미지 칸은 대상 아님.
 *
 * REGRESSION-FREEZE[schedule-photo-step-keeps-supplier-original]: process-images 재작성 시 supplierOriginal·숙소·식사 유지 — manifest
 */
export const STORED_SCHEDULE_DAY_EVIDENCE_KEYS = [
  'supplierOriginal',
  'hotelText',
  'breakfastText',
  'lunchText',
  'dinnerText',
  'mealSummaryText',
  'meals',
] as const

type StoredRow = Record<string, unknown>

export function parseStoredScheduleRows(schedule: string | null | undefined): StoredRow[] {
  if (!schedule || typeof schedule !== 'string') return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is StoredRow => !!x && typeof x === 'object') : []
  } catch {
    return []
  }
}

function isEmptyValue(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '')
}

export function preserveStoredScheduleDayEvidence<T extends { day?: unknown }>(
  next: readonly T[],
  stored: readonly StoredRow[],
): T[] {
  const byDay = new Map<number, StoredRow>()
  for (const row of stored) {
    const d = Number(row.day)
    if (Number.isFinite(d) && !byDay.has(d)) byDay.set(d, row)
  }
  return next.map((row) => {
    const prev = byDay.get(Number(row.day))
    if (!prev) return row
    const patch: Record<string, unknown> = {}
    const cur = row as unknown as Record<string, unknown>
    for (const key of STORED_SCHEDULE_DAY_EVIDENCE_KEYS) {
      if (isEmptyValue(cur[key]) && !isEmptyValue(prev[key])) patch[key] = prev[key]
    }
    return Object.keys(patch).length ? ({ ...row, ...patch } as T) : row
  })
}
