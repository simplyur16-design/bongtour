import { describe, expect, it } from 'vitest'
import { computeEffectivePricePerPersonKrwFromRow } from '@/lib/product-price-per-person'

describe('computeEffectivePricePerPersonKrwFromRow', () => {
  it('출발행 adultPrice 최저를 우선한다', () => {
    const n = computeEffectivePricePerPersonKrwFromRow({
      id: 'a',
      priceFrom: 9_999_000,
      departures: [
        { adultPrice: 3_000_000, departureDate: new Date('2026-10-01') },
        { adultPrice: 2_500_000, departureDate: new Date('2026-10-08') },
      ],
      prices: [{ adult: 1_000_000 }],
    })
    expect(n).toBe(2_500_000)
  })

  // REGRESSION-FREEZE[browse-price-product-price-fallback]: ProductDeparture 없을 때 ProductPrice 최저 — manifest
  it('출발행이 없으면 ProductPrice.adult 최저로 폴백한다', () => {
    const n = computeEffectivePricePerPersonKrwFromRow({
      id: 'b',
      priceFrom: null,
      minBookableAdultPrice: null,
      departures: [],
      prices: [
        { adult: 5_749_000 },
        { adult: 4_449_000 },
        { adult: 0 },
      ],
    })
    expect(n).toBe(4_449_000)
  })

  it('출발·ProductPrice·priceFrom 모두 없으면 null (문의)', () => {
    const n = computeEffectivePricePerPersonKrwFromRow({
      id: 'c',
      priceFrom: null,
      departures: [{ adultPrice: null, departureDate: new Date('2026-11-01') }],
      prices: [{ adult: 0 }],
    })
    expect(n).toBeNull()
  })
})
