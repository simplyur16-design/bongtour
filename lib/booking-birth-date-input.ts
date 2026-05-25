/**
 * 예약 접수(BookingIntakeModal) 생년월일 8자리(YYYYMMDD) 입력 — 표시·검증 SSOT.
 * 서버 contract는 YYYY-MM-DD 그대로; 클라이언트에서 변환 후 전송.
 */

export const BOOKING_BIRTH_DATE_MIN_YEAR = 1900

export type BirthDateParseResult =
  | { ok: true; ymd: string; digits: string }
  | { ok: false; message: string; digits: string }

/** 숫자만, 최대 8자리 */
export function normalizeBirthDateDigitsInput(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 8)
}

/** 입력 중·완료 후 표시용 (1978 → 1978-02 → 1978-02-16) */
export function formatBirthDateDigitsForDisplay(digits: string): string {
  const d = normalizeBirthDateDigitsInput(digits)
  if (d.length <= 4) return d
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
}

function utcDateParts(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

function isRealCalendarDate(y: number, m: number, day: number): boolean {
  if (m < 1 || m > 12 || day < 1 || day > 31) return false
  const dt = utcDateParts(y, m, day)
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day
}

function todayUtcYmd(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 8자리 → YYYY-MM-DD. 미완·무효·미래·비현실 연도 거부. */
export function parseBirthDateDigitsToYmd(digits: string): BirthDateParseResult {
  const d = normalizeBirthDateDigitsInput(digits)
  if (d.length !== 8) {
    return { ok: false, message: '생년월일 8자리(YYYYMMDD)를 입력해 주세요.', digits: d }
  }
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(4, 6))
  const day = Number(d.slice(6, 8))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
    return { ok: false, message: '생년월일이 올바르지 않습니다.', digits: d }
  }
  if (y < BOOKING_BIRTH_DATE_MIN_YEAR) {
    return { ok: false, message: '생년월일 연도를 확인해 주세요.', digits: d }
  }
  if (!isRealCalendarDate(y, m, day)) {
    return { ok: false, message: '생년월일이 올바르지 않습니다.', digits: d }
  }
  const ymd = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  const today = todayUtcYmd()
  if (ymd > today) {
    return { ok: false, message: '미래 날짜는 입력할 수 없습니다.', digits: d }
  }
  return { ok: true, ymd, digits: d }
}
