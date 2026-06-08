/** slim-row live build 오염 탐지 — audit·payload-io read path SSOT */

export type PayloadCorruptKind = 'empty_shell' | 'title_mismatch' | 'schedule_missing'

export type PayloadViewForCorruptCheck = {
  title?: string
  schedule?: unknown
}

/** ~8KB 미만 empty_shell — `scripts/audit-corrupt-product-detail-payload.ts` 와 동일 */
export const EMPTY_SHELL_PAYLOAD_MAX_BYTES = 8000

export function payloadViewScheduleLen(schedule: unknown): number {
  if (schedule == null) return 0
  if (typeof schedule === 'string') {
    try {
      const arr = JSON.parse(schedule) as unknown
      return Array.isArray(arr) ? arr.length : 0
    } catch {
      return 0
    }
  }
  return Array.isArray(schedule) ? schedule.length : -1
}

/** DB 없이 read path용 — title 빈값·schedule 비어 있음·소형 payload */
export function isEmptyShellPayloadView(
  view: PayloadViewForCorruptCheck | null | undefined,
  payloadBytes: number,
): boolean {
  if (!view) return false
  const payloadTitle = (view.title ?? '').trim()
  const payloadSchedLen = payloadViewScheduleLen(view.schedule)
  return (
    payloadTitle === '' &&
    (view.schedule == null || payloadSchedLen === 0) &&
    payloadBytes > 0 &&
    payloadBytes < EMPTY_SHELL_PAYLOAD_MAX_BYTES
  )
}

export function assessPayloadCorruption(
  dbTitle: string,
  dbScheduleLen: number,
  view: PayloadViewForCorruptCheck | null | undefined,
  payloadBytes: number,
): { corrupt: boolean; kind: PayloadCorruptKind | null } {
  if (!view) return { corrupt: false, kind: null }
  const payloadTitle = (view.title ?? '').trim()
  const payloadSchedLen = payloadViewScheduleLen(view.schedule)
  const dbHasBody = dbTitle.trim().length > 0 || dbScheduleLen > 0

  if (dbHasBody && isEmptyShellPayloadView(view, payloadBytes)) {
    return { corrupt: true, kind: 'empty_shell' }
  }
  if (dbTitle.trim() && payloadTitle && dbTitle.trim() !== payloadTitle.trim() && payloadTitle.length < 4) {
    return { corrupt: true, kind: 'title_mismatch' }
  }
  if (dbScheduleLen >= 2 && payloadSchedLen === 0 && payloadBytes < EMPTY_SHELL_PAYLOAD_MAX_BYTES) {
    return { corrupt: true, kind: 'schedule_missing' }
  }
  return { corrupt: false, kind: null }
}
