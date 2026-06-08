import { deriveRemainingSeatCount } from '@/lib/departure-seat-availability'

/**
 * statusRaw / seatsStatusRaw / seatCount → isConfirmed, isBookable.
 * 명확할 때만 채우고, 애매하면 null.
 */
export function deriveDepartureFlags(
  statusRaw?: string | null,
  seatsStatusRaw?: string | null,
  seatCount?: number | null,
): { isConfirmed: boolean | null; isBookable: boolean | null } {
  const raw = (statusRaw ?? '').trim()
  const seats = (seatsStatusRaw ?? '').trim()
  let isConfirmed: boolean | null = null
  let isBookable: boolean | null = null

  const remaining = deriveRemainingSeatCount({ seatCount, seatsStatusRaw, statusRaw })
  if (remaining != null && remaining <= 0) {
    return { isConfirmed: isConfirmed ?? false, isBookable: false }
  }

  if (raw) {
    if (/출발\s*확정|확정\s*출발/i.test(raw)) isConfirmed = true
    else if (/마감|불가|취소/i.test(raw)) {
      isConfirmed = false
      isBookable = false
    }
  }
  if (isBookable === null && (raw || seats)) {
    if (/대기\s*예약|대기/i.test(raw)) isBookable = null
    else if (/예약\s*가능|예약가능|가능/i.test(raw)) isBookable = true
    else if (/잔여\s*[1-9]\d*/i.test(seats) || /\b[1-9]\d*\s*석/.test(seats)) isBookable = true
    else if (/마감|불가/i.test(raw) || /마감|불가|만석|매진/i.test(seats)) isBookable = false
  }

  return { isConfirmed, isBookable }
}
