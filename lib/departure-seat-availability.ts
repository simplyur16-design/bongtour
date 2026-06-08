/**
 * 출발일 잔여좌석·판매완료 SSOT — 달력·목록 카드·등록 upsert 공용.
 */
import { getPriceAdult } from '@/lib/price-utils'

export type DepartureSeatRowLike = {
  adult?: number | null
  priceAdult?: number | null
  adultBase?: number | null
  adultFuel?: number | null
  availableSeats?: number | null
  seatCount?: number | null
  seatsStatusRaw?: string | null
  status?: string | null
  statusRaw?: string | null
  isBookable?: boolean | null
}

const SOLD_OUT_TEXT = /마감|만석|매진|판매\s*완료|판매\s*종료|sold\s*out|예약\s*불가/i

/** `seatCount`·`availableSeats`·`seatsStatusRaw`·`status`에서 잔여석 숫자 복원 */
export function deriveRemainingSeatCount(row: DepartureSeatRowLike): number | null {
  const explicit = row.availableSeats ?? row.seatCount
  if (explicit != null && Number.isFinite(Number(explicit))) return Math.floor(Number(explicit))

  const seatsRaw = (row.seatsStatusRaw ?? '').trim()
  if (seatsRaw) {
    const m1 = seatsRaw.match(/잔여\s*(\d+)/i)
    if (m1) return Math.floor(Number(m1[1]))
    const m2 = seatsRaw.match(/(\d+)\s*석/)
    if (m2) return Math.floor(Number(m2[1]))
    if (SOLD_OUT_TEXT.test(seatsRaw)) return 0
  }

  const status = (row.status ?? row.statusRaw ?? '').trim()
  if (status && SOLD_OUT_TEXT.test(status)) return 0

  return null
}

/**
 * 판매완료 — **성인가가 있고** 잔여석이 없음이 확인될 때만 true.
 * 가격 없음(미운영)·좌석 정보 미수집(null)은 판매완료가 아님.
 */
export function isDepartureSoldOut(row: DepartureSeatRowLike): boolean {
  if (departureRowAdultKrw(row) <= 0) return false

  const seats = deriveRemainingSeatCount(row)
  if (seats != null) return seats <= 0

  const blob = `${row.status ?? ''} ${row.statusRaw ?? ''} ${row.seatsStatusRaw ?? ''}`.trim()
  return blob.length > 0 && SOLD_OUT_TEXT.test(blob)
}

/** ProductPriceRow `adult`·`priceAdult`·base/fuel 슬롯 통합 */
export function departureRowAdultKrw(row: DepartureSeatRowLike): number {
  if (row.adult != null && row.adult > 0) return row.adult
  if (row.priceAdult != null && row.priceAdult > 0) return row.priceAdult
  return getPriceAdult(row as never)
}

/** 공개 달력·카드 — 성인가 있고 판매완료가 아님 */
export function isDepartureRowPublicBookable(row: DepartureSeatRowLike): boolean {
  return departureRowAdultKrw(row) > 0 && !isDepartureSoldOut(row)
}

/** 등록 파싱 — `availableSeats`·`seatsStatusRaw` → DB `seatCount`·원문 */
export function seatFieldsFromParsedCalendarPrice(p: {
  availableSeats?: number | null
  seatsStatusRaw?: string | null
  status?: string | null
}): { seatCount?: number; seatsStatusRaw?: string } {
  const fromAvail =
    p.availableSeats != null && Number.isFinite(Number(p.availableSeats))
      ? Math.floor(Number(p.availableSeats))
      : undefined
  const seatsRawIn = p.seatsStatusRaw != null && String(p.seatsStatusRaw).trim() ? String(p.seatsStatusRaw).trim() : ''
  const seatsStatusRaw = fromAvail != null ? `잔여${fromAvail}` : seatsRawIn || undefined
  const seatCount = fromAvail ?? deriveRemainingSeatCount({ seatsStatusRaw, status: p.status }) ?? undefined
  return {
    ...(seatCount != null ? { seatCount } : {}),
    ...(seatsStatusRaw ? { seatsStatusRaw } : {}),
  }
}

/** ProductDeparture → ProductPriceRow `availableSeats` 보강 */
export function availableSeatsForPriceRow(d: {
  seatCount?: number | null
  seatsStatusRaw?: string | null
  statusRaw?: string | null
}): number | undefined {
  const n = deriveRemainingSeatCount({
    seatCount: d.seatCount,
    seatsStatusRaw: d.seatsStatusRaw,
    statusRaw: d.statusRaw,
  })
  return n != null ? n : undefined
}
