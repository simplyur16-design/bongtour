import { describe, expect, it, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { productDeparture: { findMany: (...a: unknown[]) => findMany(...a) } } }))

import {
  isLiteDepartureBookableForCheapest,
  withCheapestBookableDateDepartures,
} from '@/lib/product-detail-cheapest-date-departures'

const day = (n: number) => new Date(Date.UTC(2026, 10, n))
function rows(count: number, price: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    departureDate: day(1 + Math.floor(i / 20)),
    adultPrice: price,
    seatCount: 5,
    statusRaw: '예약진행',
  }))
}

describe('detail cheapest-date rows beyond the 100-row cap (yb-0026)', () => {
  beforeEach(() => findMany.mockReset())

  it('bookable predicate excludes 마감·sold out·no price', () => {
    const base = { departureDate: day(1), adultPrice: 1, seatCount: 3, statusRaw: '예약진행' }
    expect(isLiteDepartureBookableForCheapest(base)).toBe(true)
    expect(isLiteDepartureBookableForCheapest({ ...base, statusRaw: '예약마감' })).toBe(false)
    expect(isLiteDepartureBookableForCheapest({ ...base, seatCount: 0 })).toBe(false)
    expect(isLiteDepartureBookableForCheapest({ ...base, adultPrice: null })).toBe(false)
    expect(isLiteDepartureBookableForCheapest({ ...base, isBookable: false })).toBe(false)
  })

  it('under 100 rows: untouched, no query', async () => {
    const r = { id: 'p', departures: rows(40, 599900) }
    expect(await withCheapestBookableDateDepartures(r)).toBe(r)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('cheaper bookable date beyond the cap: appends all rows of that date', async () => {
    findMany
      .mockResolvedValueOnce([
        { departureDate: day(20), adultPrice: 499900, seatCount: 0, statusRaw: '예약진행' },
        { departureDate: day(25), adultPrice: 549900, seatCount: 6, statusRaw: '예약진행' },
      ])
      .mockResolvedValueOnce([
        { id: 'x1', departureDate: day(25), adultPrice: 549900, seatCount: 6, statusRaw: '예약진행' },
        { id: 'x2', departureDate: day(25), adultPrice: 1099900, seatCount: 4, statusRaw: '예약진행' },
      ])
    const out = await withCheapestBookableDateDepartures({ id: 'p', departures: rows(100, 599900) })
    expect(out.departures).toHaveLength(102)
    expect(out.departures.slice(-2).map((d) => d.id)).toEqual(['x1', 'x2'])
  })

  it('nothing cheaper beyond the cap: untouched', async () => {
    findMany.mockResolvedValueOnce([{ departureDate: day(25), adultPrice: 599900, seatCount: 6, statusRaw: '예약진행' }])
    const r = { id: 'p', departures: rows(100, 599900) }
    expect(await withCheapestBookableDateDepartures(r)).toBe(r)
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
