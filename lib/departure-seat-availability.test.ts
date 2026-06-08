import { describe, expect, it } from 'vitest'
import {
  deriveRemainingSeatCount,
  enrichPriceRowsWithProductRemainingSeats,
  isDepartureRowPublicBookable,
  isDepartureSoldOut,
  seatFieldsFromParsedCalendarPrice,
} from '@/lib/departure-seat-availability'

describe('departure-seat-availability', () => {
  it('derives seat count from seatsStatusRaw when seatCount missing', () => {
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '잔여12' })).toBe(12)
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '좌석 : 3석' })).toBe(3)
    expect(deriveRemainingSeatCount({ seatsStatusRaw: '잔여0' })).toBe(0)
  })

  it('판매완료 — 가격 있고 잔여 0이 숫자로 확인될 때만', () => {
    expect(isDepartureSoldOut({ availableSeats: 0, adult: 1_000_000, seatsStatusRaw: '잔여0' })).toBe(true)
    expect(isDepartureSoldOut({ seatsStatusRaw: '마감', adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ availableSeats: 3, adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ availableSeats: 0, adult: 0, seatsStatusRaw: '잔여0' })).toBe(false)
    expect(isDepartureSoldOut({ adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ adult: 1_000_000, isBookable: false })).toBe(false)
    expect(isDepartureSoldOut({ seatCount: 0, adult: 1_000_000 })).toBe(false)
    expect(isDepartureSoldOut({ adult: 0, seatsStatusRaw: '마감', statusRaw: '마감' })).toBe(false)
  })

  it('parses 좌석 : 20 from reservation line — 예약 0 is not sold out', () => {
    const row = {
      seatCount: 0,
      statusRaw: '예약 : 0명 좌석 : 20석 (최소출발 : 성인 8명)',
      adult: 900_000,
    }
    expect(deriveRemainingSeatCount(row)).toBe(20)
    expect(isDepartureSoldOut(row)).toBe(false)
    expect(isDepartureRowPublicBookable(row)).toBe(true)
  })

  it('enrichPriceRowsWithProductRemainingSeats fills missing row seats from product meta', () => {
    const rows = enrichPriceRowsWithProductRemainingSeats(
      [{ id: '1', date: '2026-06-11', adult: 839_000, seatCount: 0 }],
      8,
    )
    expect(rows[0]?.availableSeats).toBe(8)
    expect(isDepartureSoldOut(rows[0]!)).toBe(false)
  })

  it('public bookable — 가격 있고 잔여석 확인 시에만 마감', () => {
    expect(isDepartureRowPublicBookable({ adult: 900_000, availableSeats: 2 })).toBe(true)
    expect(
      isDepartureRowPublicBookable({ adult: 900_000, availableSeats: 0, seatsStatusRaw: '잔여0' }),
    ).toBe(false)
    expect(isDepartureRowPublicBookable({ adult: 900_000 })).toBe(true)
    expect(isDepartureRowPublicBookable({ adult: 0, availableSeats: 5 })).toBe(false)
  })

  it('seatFieldsFromParsedCalendarPrice fills seatCount from availableSeats', () => {
    expect(seatFieldsFromParsedCalendarPrice({ availableSeats: 4 })).toEqual({
      seatCount: 4,
      seatsStatusRaw: '잔여4',
    })
  })

  it('seatFieldsFromParsedCalendarPrice — availableSeats 0 without sold-out hint is not 잔여0', () => {
    expect(seatFieldsFromParsedCalendarPrice({ availableSeats: 0 })).toEqual({})
    expect(
      seatFieldsFromParsedCalendarPrice({
        availableSeats: 0,
        status: '예약 : 0명 좌석 : 20석',
      }),
    ).toEqual({ seatCount: 20, seatsStatusRaw: '잔여20' })
  })
})
