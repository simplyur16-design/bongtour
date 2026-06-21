import { describe, expect, it } from 'vitest'
import {
  flightStructuredToRegisterFactLegs,
  inferDepartureAirportFieldsFromStoredProduct,
  scheduleJsonToInferHaystack,
  shouldUpdateStoredDepartureAirportFields,
} from '@/lib/backfill-product-departure-airport'
import type { FlightStructured } from '@/lib/detail-body-parser-types'

describe('flightStructuredToRegisterFactLegs', () => {
  it('maps outbound/inbound airports to register-fact legs', () => {
    const fs: FlightStructured = {
      airlineName: 'KE',
      outbound: {
        departureAirport: '부산',
        departureAirportCode: 'PUS',
        departureDate: '2026-07-01',
        departureTime: '10:00',
        arrivalAirport: '방콕',
        arrivalAirportCode: 'BKK',
        arrivalDate: '2026-07-01',
        arrivalTime: '14:00',
        flightNo: 'KE651',
        durationText: null,
      },
      inbound: {
        departureAirport: '방콕',
        departureAirportCode: 'BKK',
        departureDate: '2026-07-05',
        departureTime: null,
        arrivalAirport: '부산',
        arrivalAirportCode: 'PUS',
        arrivalDate: null,
        arrivalTime: null,
        flightNo: 'KE652',
        durationText: null,
      },
      rawFlightLines: [],
    }
    const legs = flightStructuredToRegisterFactLegs(fs)
    expect(legs).toHaveLength(2)
    expect(legs[0]?.departureCity).toBe('부산')
    expect(legs[1]?.departureCity).toBe('방콕')
  })
})

describe('inferDepartureAirportFieldsFromStoredProduct', () => {
  it('infers busan from rawMeta flightStructured', () => {
    const rawMeta = JSON.stringify({
      structuredSignals: {
        flightStructured: {
          airlineName: 'KE',
          outbound: {
            departureAirport: '부산국제공항',
            departureAirportCode: 'PUS',
            departureDate: null,
            departureTime: null,
            arrivalAirport: null,
            arrivalAirportCode: null,
            arrivalDate: null,
            arrivalTime: null,
            flightNo: null,
            durationText: null,
          },
          inbound: {
            departureAirport: null,
            departureAirportCode: null,
            departureDate: null,
            departureTime: null,
            arrivalAirport: null,
            arrivalAirportCode: null,
            arrivalDate: null,
            arrivalTime: null,
            flightNo: null,
            durationText: null,
          },
          rawFlightLines: [],
        },
      },
    })
    const inferred = inferDepartureAirportFieldsFromStoredProduct({
      airline: 'KE',
      includedText: null,
      scheduleJson: null,
      itineraryHaystack: null,
      rawMeta,
      existingLocalDepartureTags: [],
    })
    expect(inferred.departureAirportLabel).toBe('busan')
    expect(inferred.localDepartureTag).toEqual(['busan'])
  })
})

describe('scheduleJsonToInferHaystack', () => {
  it('parses schedule JSON rows for infer haystack', () => {
    const hay = scheduleJsonToInferHaystack(
      JSON.stringify([{ title: '1일차', description: '부산 출발', routeText: '부산-방콕' }]),
    )
    expect(hay).toContain('부산')
  })
})

describe('shouldUpdateStoredDepartureAirportFields', () => {
  it('onlyFillMissing skips when label already set', () => {
    expect(
      shouldUpdateStoredDepartureAirportFields({
        currentLabel: 'busan',
        currentTags: ['busan'],
        inferred: { departureAirportLabel: 'busan', localDepartureTag: ['busan'] },
        onlyFillMissing: true,
      }),
    ).toBe(false)
  })

  it('onlyFillMissing updates when label null and inferred busan', () => {
    expect(
      shouldUpdateStoredDepartureAirportFields({
        currentLabel: null,
        currentTags: [],
        inferred: { departureAirportLabel: 'busan', localDepartureTag: ['busan'] },
        onlyFillMissing: true,
      }),
    ).toBe(true)
  })
})
