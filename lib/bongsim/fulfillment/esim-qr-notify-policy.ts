/**
 * eSIM QR 문자 안전장치. 기본값은 기존 동작.
 * - BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS: 비우거나 0이면 보류 없음.
 * - BONGSIM_ESIM_QR_NOTIFY_DRY_RUN: `1`일 때만 Solapi를 건너뛴다.
 *
 * REGRESSION-FREEZE[esim-qr-notify-hold-dry-run]: 오래된 미발송은 보류, dry-run은 미처리 유지 — manifest
 */

export const ESIM_QR_NOTIFY_TICK_SEND_CAP = 24

export const COMPLIMENTARY_GRANT_DEDUPE_WINDOW_MINUTES = 10

/** 미처리·비종결·비보류. 양보 카운트와 발송 픽이 같이 쓴다. */
export const ESIM_QR_NOTIFY_FRESH_PENDING_SQL = `processed_at IS NULL
  AND COALESCE(payload->'_outbox_defer'->>'terminal', 'false') <> 'true'
  AND COALESCE(payload->'_outbox_hold'->>'active', 'false') <> 'true'`

export function esimQrNotifyHoldAfterHours(): number | null {
  const raw = process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS
  if (raw == null || raw.trim() === '' || raw.trim() === '0') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return null
  return n
}

/**
 * countPendingEsimQrNotify 와 야간 수집 폴백이 같이 쓰는 읽기 전용 COUNT.
 * $2 가 null(보류 시간 기본값)이면 나이 조건은 빠진다. 이미 보류·종결된 행은 항상 뺀다.
 * 보류 UPDATE 는 넣지 않는다.
 */
export function esimQrNotifyPendingCountSql(): string {
  return `SELECT COUNT(*)::int AS n
       FROM bongsim_outbox
      WHERE topic = $1
        AND ${ESIM_QR_NOTIFY_FRESH_PENDING_SQL}
        AND (
          $2::int IS NULL
          OR (
            NULLIF(payload->>'_enqueued_at', '') IS NOT NULL
            AND (payload->>'_enqueued_at')::timestamptz >= now() - ($2::int * interval '1 hour')
          )
        )`
}

export function isEsimQrNotifyDryRun(): boolean {
  return process.env.BONGSIM_ESIM_QR_NOTIFY_DRY_RUN === '1'
}

export function maskEsimNotifyPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 4) return null
  return `***${digits.slice(-4)}`
}

export type EsimQrHoldRow = {
  enqueuedAt: string | null
  availableAtMs: number
  held: boolean
  terminal: boolean
  processed: boolean
}

/**
 * 기능이 켜져 있을 때만. `_enqueued_at`이 없으면 배포 전 백로그로 보고 보류 대상이다.
 * `_enqueued_at`이 있으면 그 시각이 기준보다 오래됐을 때만.
 */
export function esimQrNotifyRowNeedsAgeHold(
  row: EsimQrHoldRow,
  holdAfterHours: number | null,
  nowMs: number,
): boolean {
  if (holdAfterHours == null) return false
  if (row.processed || row.terminal || row.held) return false
  if (!row.enqueuedAt) return true
  const enqueued = Date.parse(row.enqueuedAt)
  if (!Number.isFinite(enqueued)) return true
  return nowMs - enqueued >= holdAfterHours * 60 * 60 * 1000
}
