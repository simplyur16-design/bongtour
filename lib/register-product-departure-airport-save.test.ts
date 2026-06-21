import { describe, expect, it } from 'vitest'
import {
  parseRegisterFactFlightsFromAdminBody,
  resolveRegisterProductDepartureAirportFields,
} from '@/lib/register-product-departure-airport-save'

describe('parseRegisterFactFlightsFromAdminBody', () => {
  it('parses registerFactFlights array from confirm body', () => {
    const legs = parseRegisterFactFlightsFromAdminBody({
      registerFactFlights: [
        {
          direction: 'outbound',
          carrier: 'KE',
          flightNo: 'KE123',
          departureCity: '부산',
          departureAt: '2026-07-01',
          arrivalCity: '방콕',
          arrivalAt: '2026-07-01',
        },
      ],
    })
    expect(legs).toHaveLength(1)
    expect(legs[0]?.departureCity).toBe('부산')
  })
})

describe('resolveRegisterProductDepartureAirportFields', () => {
  it('prefers API fact flights over haystack for busan label', () => {
    const fields = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '인천국제공항',
      factFlights: [
        {
          direction: 'outbound',
          carrier: 'KE',
          flightNo: 'KE123',
          departureCity: '부산',
          departureAt: null,
          arrivalCity: '방콕',
          arrivalAt: null,
        },
      ],
    })
    expect(fields.departureAirportLabel).toBe('busan')
    expect(fields.localDepartureTag).toEqual(['busan'])
  })
})
