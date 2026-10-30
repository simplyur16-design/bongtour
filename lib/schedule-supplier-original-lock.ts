/**
 * REGRESSION-FREEZE[schedule-supplier-original-lock]: 공급사 원문 일정 잠금 — heal·FIT master sync·lane remat 가 일정 문장/ItineraryDay 를 덮어쓰지 않음 — manifest
 *
 * Product.rawMeta(JSON 문자열)의 `scheduleSupplierOriginalLock` 키로 표시한다. 스키마 변경 없음.
 * 값 예: { "lockedAt": "2026-10-30T10:00:00.000Z", "source": "supplier_original", "reason": "owner 2026-10-30 일정 원본 교체" }
 * 잠금은 신규·등록대기·등록 상품 모두에 같은 방식으로 적용된다(상태 무관).
 */
export const SCHEDULE_SUPPLIER_ORIGINAL_LOCK_KEY = 'scheduleSupplierOriginalLock'

export type ScheduleSupplierOriginalLock = {
  lockedAt: string
  source: 'supplier_original'
  reason?: string
}

function parseRawMeta(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta || typeof rawMeta !== 'string') return {}
  try {
    const v = JSON.parse(rawMeta) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function readScheduleSupplierOriginalLock(
  rawMeta: string | null | undefined,
): ScheduleSupplierOriginalLock | null {
  const v = parseRawMeta(rawMeta)[SCHEDULE_SUPPLIER_ORIGINAL_LOCK_KEY]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (o.source !== 'supplier_original') return null
  if (typeof o.lockedAt !== 'string' || !o.lockedAt.trim()) return null
  return {
    lockedAt: o.lockedAt,
    source: 'supplier_original',
    reason: typeof o.reason === 'string' ? o.reason : undefined,
  }
}

/** 잠긴 상품이면 true — 자동 보정은 schedule 문장·ItineraryDay 를 쓰지 않는다. */
export function isScheduleSupplierOriginalLocked(rawMeta: string | null | undefined): boolean {
  return readScheduleSupplierOriginalLock(rawMeta) != null
}

/** rawMeta 에 잠금을 넣은 새 JSON 문자열 (다른 키 보존). */
export function withScheduleSupplierOriginalLock(
  rawMeta: string | null | undefined,
  lock: ScheduleSupplierOriginalLock,
): string {
  const obj = parseRawMeta(rawMeta)
  obj[SCHEDULE_SUPPLIER_ORIGINAL_LOCK_KEY] = lock
  return JSON.stringify(obj)
}
