import { describe, expect, it } from 'vitest'
import {
  enrichHanatourDepartureInputsFromProductPriceTable,
  enrichHanatourParsedPricesFromProductPriceTable,
} from '@/lib/product-departure-to-price-rows-hanatour'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'

describe('enrichHanatourDepartureInputsFromProductPriceTable', () => {
  const table = {
    adultPrice: 1_200_000,
    childExtraBedPrice: 980_000,
    childNoBedPrice: null,
    infantPrice: 150_000,
  }

  it('fills missing child and infant from body table', () => {
    const inputs: DepartureInput[] = [
      { departureDate: '2026-07-01', adultPrice: 1_250_000 },
      { departureDate: '2026-07-08', adultPrice: 1_280_000 },
    ]
    const out = enrichHanatourDepartureInputsFromProductPriceTable(inputs, table)
    expect(out[0]?.childBedPrice).toBe(980_000)
    expect(out[1]?.childBedPrice).toBe(980_000)
    expect(out[0]?.infantPrice).toBe(150_000)
  })

  it('does not overwrite distinct per-departure child tiers', () => {
    const inputs: DepartureInput[] = [
      { departureDate: '2026-07-01', adultPrice: 1_250_000, childBedPrice: 900_000 },
    ]
    const out = enrichHanatourDepartureInputsFromProductPriceTable(inputs, table)
    expect(out[0]?.childBedPrice).toBe(900_000)
  })
})

describe('enrichHanatourParsedPricesFromProductPriceTable', () => {
  it('fills childBedBase when calendar rows are adult-only', () => {
    const out = enrichHanatourParsedPricesFromProductPriceTable(
      [
        {
          date: '2026-07-01',
          adultBase: 1_250_000,
          adultFuel: 0,
          childFuel: 0,
          infantFuel: 0,
          status: '예약가능',
          availableSeats: 0,
        },
      ],
      {
        adultPrice: 1_200_000,
        childExtraBedPrice: 980_000,
        childNoBedPrice: null,
        infantPrice: 150_000,
      },
    )
    expect(out[0]?.childBedBase).toBe(980_000)
    expect(out[0]?.infantBase).toBe(150_000)
  })
})
