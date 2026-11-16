import { describe, expect, it } from 'vitest'
import { minCardFutureAdultPrice } from '@/lib/card-future-min-adult-price'
import type { CardFutureDeparturePriceRow } from '@/lib/card-future-min-adult-price'

function row(
  index: number,
  adultPrice: number,
  extra: Partial<CardFutureDeparturePriceRow> = {},
): CardFutureDeparturePriceRow {
  const floor = new Date('2026-11-16T00:00:00+09:00')
  return {
    adultPrice,
    departureDate: new Date(floor.getTime() + (index + 1) * 24 * 60 * 60 * 1000),
    isBookable: null,
    seatCount: null,
    seatsStatusRaw: '',
    statusRaw: '',
    ...extra,
  }
}

describe('minCardFutureAdultPrice', () => {
  const floor = new Date('2026-11-16T00:00:00+09:00')

  // REGRESSION-FREEZE[card-min-price-beyond-row-cap]: 91번째 849000이 80행 상한에 잘리지 않음 — manifest
  it('80행을 넘는 출발의 최저가를 고른다', () => {
    const rows = Array.from({ length: 121 }, (_, i) => row(i, i === 90 ? 849_000 : 899_000))
    expect(minCardFutureAdultPrice(rows.slice(0, 80), floor)).toBe(899_000)
    expect(minCardFutureAdultPrice(rows, floor)).toBe(849_000)
  })

  it('마감·판매완료·지난 출발의 더 싼 가격은 카드 최저가에서 제외한다', () => {
    const rows = [
      row(0, 100_000, { isBookable: false }),
      row(1, 200_000, { seatCount: 0, seatsStatusRaw: '잔여0', statusRaw: '마감' }),
      row(-5, 300_000, { departureDate: new Date('2026-11-15T00:00:00+09:00') }),
      row(2, 849_000),
      row(3, 899_000),
    ]
    expect(minCardFutureAdultPrice(rows, floor)).toBe(849_000)
  })
})
