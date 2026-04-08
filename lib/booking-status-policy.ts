/**
 * 예약(Booking) 상태값 및 전이 정책 — 관리자 수동 처리 기준.
 * DB `Booking.status` 문자열과 1:1로 맞출 것.
 */

export const BOOKING_STATUSES = [
  '접수완료',
  '상담중',
  '예약진행중',
  '예약확정',
  '보류',
  '취소',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export function isBookingStatus(s: string): s is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(s)
}

/** from -> 허용되는 to 목록 */
const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  접수완료: ['상담중', '예약진행중', '보류', '취소'],
  상담중: ['예약진행중', '예약확정', '보류', '취소'],
  예약진행중: ['예약확정', '보류', '취소'],
  예약확정: ['취소'],
  보류: ['접수완료', '상담중', '예약진행중', '취소'],
  취소: ['접수완료', '상담중'],
}

export function isBookingStatusTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

/** UI용: 현재 상태에서 이동 가능한 다음 상태 목록(같은 상태 제외) */
export function getNextBookingStatuses(from: string): BookingStatus[] {
  if (!isBookingStatus(from)) return []
  return [...ALLOWED[from]]
}

export function assertBookingStatusTransition(
  from: string,
  to: string
): { ok: true; from: BookingStatus; to: BookingStatus } | { ok: false; error: string } {
  if (!isBookingStatus(from)) {
    return { ok: false, error: `알 수 없는 현재 상태: ${from}` }
  }
  if (!isBookingStatus(to)) {
    return { ok: false, error: `허용되지 않는 상태값: ${to}` }
  }
  if (from === to) return { ok: true, from, to }
  if (!isBookingStatusTransitionAllowed(from, to)) {
    return {
      ok: false,
      error: `상태 전이 불가: ${from} → ${to}. 허용: ${ALLOWED[from].join(', ')}`,
    }
  }
  return { ok: true, from, to }
}
