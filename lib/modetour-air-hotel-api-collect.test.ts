import { describe, expect, it } from 'vitest'
import { modetourGroupDetailToDepartureInput } from '@/lib/modetour-departures'

describe('modetourGroupDetailToDepartureInput', () => {
  it('maps group detail to a priced departure input', () => {
    const out = modetourGroupDetailToDepartureInput({
      groupNumber: 102323588,
      departureDate: '2026-06-19T00:00:00',
      sellingPriceAdultTotalAmount: 579900,
    })
    expect(out?.departureDate).toBe('2026-06-19')
    expect(out?.adultPrice).toBe(579900)
    expect(out?.supplierDepartureCodeCandidate).toBe('modetour:102323588')
  })

  it('returns null when price missing', () => {
    expect(
      modetourGroupDetailToDepartureInput({
        groupNumber: 1,
        departureDate: '2026-07-01',
        sellingPriceAdultTotalAmount: 0,
      }),
    ).toBeNull()
  })
})
