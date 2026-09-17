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

  it('falls back to title strong marker when fact flights are incheon-only', () => {
    // REGRESSION-FREEZE[register-pending-local-departure-strong-signal]
    const fields = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '[부산] 후쿠오카 1일\n인천국제공항',
      factFlights: [
        {
          direction: 'outbound',
          carrier: 'KE',
          flightNo: 'KE123',
          departureCity: '인천',
          departureAt: null,
          arrivalCity: '후쿠오카',
          arrivalAt: null,
        },
      ],
    })
    expect(fields.departureAirportLabel).toBe('busan')
    expect(fields.localDepartureTag).toEqual(['busan'])
  })

  it('clears false busan from connect marketing when no strong marker', () => {
    const fields = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '스페인 클래식\n부산출발 내항기 연결 가능 (담당자 별도 문의)',
      factFlights: [],
    })
    expect(fields.departureAirportLabel).toBeNull()
    expect(fields.localDepartureTag).toEqual([])
  })
})
