import { describe, expect, it } from 'vitest'
import {
  inferDepartureAirportFromRegisterFactFlights,
  inferHomeDepartureAirportFromFlightText,
} from '@/lib/infer-home-departure-airport'

describe('inferHomeDepartureAirportFromFlightText', () => {
  it('returns null for incheon (default, no label)', () => {
    expect(inferHomeDepartureAirportFromFlightText('인천국제공항')).toBeNull()
    expect(inferHomeDepartureAirportFromFlightText('ICN')).toBeNull()
  })

  it('treats gimpo as seoul default (no label) and detects regional airports', () => {
    expect(inferHomeDepartureAirportFromFlightText('김포국제공항')).toBeNull()
    expect(inferHomeDepartureAirportFromFlightText('부산')).toBe('busan')
    expect(inferHomeDepartureAirportFromFlightText('제주공항')).toBe('jeju')
  })
})

describe('inferDepartureAirportFromRegisterFactFlights', () => {
  it('uses outbound departure city and sets localDepartureTag for busan', () => {
    const meta = inferDepartureAirportFromRegisterFactFlights([
      {
        direction: 'outbound',
        carrier: 'KE',
        flightNo: 'KE123',
        departureCity: '부산',
        departureAt: null,
        arrivalCity: '방콕',
        arrivalAt: null,
      },
    ])
    expect(meta.airportLabel).toBe('busan')
    expect(meta.localDepartureTags).toEqual(['busan'])
  })
})
