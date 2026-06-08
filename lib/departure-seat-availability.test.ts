import { describe, expect, it } from 'vitest'
import {
  deriveRemainingSeatCount,
  isDepartureRowPublicBookable,
  isDepartureSoldOut,
  seatFieldsFromParsedCalendarPrice,
} from '@/lib/departure-seat-availability'

describe('departure-seat-availability', () => {
  it('derives seat count from seatsStatusRaw when seatCount missing', () => {
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '잔여12' })).toBe(12)
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '3석' })).toBe(3)
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '잔여0' })).toBe(0)
  })

  it('판매완료 — 가격 있고 잔여 0 또는 마감 문구일 때만', () => {
    expect(isDepartureSoldOut({ availableSeats: 0, adult: 1_000_000 })).toBe(true)
    expect(isDepartureSoldOut({ seatsStatusRaw: '마감', adult: 1_000_000 })).toBe(true)
    expect(isDepartureSoldOut({ availableSeats: 3, adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ availableSeats: 0, adult: 0 })).toBe(false)
    expect(isDepartureSoldOut({ adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ adult: 1_000_000, isBookable: false })).toBe(false)
  })

  it('public bookable — 가격 있고 잔여석 확인 시에만 마감', () => {
    expect(isDepartureRowPublicBookable({ adult: 900_000, availableSeats: 2 })).toBe(true)
    expect(isDepartureRowPublicBookable({ adult: 900_000, availableSeats: 0 })).toBe(false)
    expect(isDepartureRowPublicBookable({ adult: 900_000 })).toBe(true)
    expect(isDepartureRowPublicBookable({ adult: 0, availableSeats: 5 })).toBe(false)
  })

  it('seatFieldsFromParsedCalendarPrice fills seatCount from availableSeats', () => {
    expect(seatFieldsFromParsedCalendarPrice({ availableSeats: 4 })).toEqual({
      seatCount: 4,
      seatsStatusRaw: '잔여4',
    })
  })
})
