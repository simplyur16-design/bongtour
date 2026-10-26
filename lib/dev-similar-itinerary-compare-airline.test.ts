import { describe, expect, it } from 'vitest'
import { resolveCompareAirlineLabel } from '@/lib/dev-similar-itinerary-compare'
import { deriveAirlineFact } from '@/lib/supplier-product-fact-ssot'

describe('resolveCompareAirlineLabel', () => {
  const baseDate = new Date('2026-10-01T00:00:00+09:00')

  it('uses cheapest bookable date carrier (not first departure)', () => {
    const label = resolveCompareAirlineLabel({
      airline: '대한항공',
      baseDate,
      prices: [
        { id: 'p-early', date: '2026-11-01', adult: 900_000 },
        { id: 'p-cheap', date: '2026-12-01', adult: 500_000 },
      ],
      departures: [
        { departureDate: '2026-11-01', carrierName: 'TW' },
        { departureDate: '2026-12-01', carrierName: 'KE' },
      ],
    })
    // KE on cheapest date — not TW from first departure
    expect(label).toBe(deriveAirlineFact({ departureKeyFactsAirline: 'KE' }).airlineLabel)
    expect(label).not.toBe(deriveAirlineFact({ departureKeyFactsAirline: 'TW' }).airlineLabel)
  })

  it('falls back to product.airline when no date/price selected', () => {
    const label = resolveCompareAirlineLabel({
      airline: '아시아나항공',
      prices: [],
      departures: [{ departureDate: '2026-11-01', carrierName: 'TW' }],
      baseDate,
    })
    expect(label).toBe('아시아나항공')
  })
})
