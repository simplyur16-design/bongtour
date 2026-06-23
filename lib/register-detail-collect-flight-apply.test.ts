/**
 * REGRESSION-FREEZE[register-detail-collect-flight-apply]
 */
import { describe, expect, it } from 'vitest'
import {
  applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
  registerFlightCollectLooksComplete,
} from './register-detail-collect-flight-apply'

describe('register detail collect flight apply', () => {
  const sampleFlight = {
    airlineName: '에어아시아',
    outbound: {
      departureAirport: '인천',
      departureAirportCode: 'ICN',
      departureDate: '2026-06-28',
      departureTime: '09:20',
      arrivalAirport: '코타키나발루',
      arrivalAirportCode: 'BKI',
      arrivalDate: '2026-06-28',
      arrivalTime: '13:30',
      flightNo: 'AK1624',
      durationText: null,
    },
    inbound: {
      departureAirport: '코타키나발루',
      departureAirportCode: 'BKI',
      departureDate: '2026-07-02',
      departureTime: '01:55',
      arrivalAirport: '인천',
      arrivalAirportCode: 'ICN',
      arrivalDate: '2026-07-02',
      arrivalTime: '08:20',
      flightNo: 'AK1623',
      durationText: null,
    },
    rawFlightLines: [],
    debug: {
      candidateCount: 2,
      selectedOutRaw: 'AK1624',
      selectedInRaw: 'AK1623',
      partialStructured: false,
      status: 'success' as const,
      exposurePolicy: 'public_full' as const,
      supplierBrandKey: 'hanatour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }

  it('needs collect when airline or flight numbers or times missing', () => {
    expect(needsRegisterFlightApiCollect({})).toBe(true)
    expect(
      needsRegisterFlightApiCollect({
        airlineName: '에어아시아',
        outboundFlightNo: 'AK1624',
        inboundFlightNo: 'AK1623',
      }),
    ).toBe(true)
    expect(
      registerFlightCollectLooksComplete(
        applyRegisterCollectedFlightStructured({}, sampleFlight),
      ),
    ).toBe(true)
  })

  it('merges flight into flat fields and detailBodyStructured even when absent', () => {
    const merged = applyRegisterCollectedFlightStructured({}, sampleFlight)
    expect(merged.airlineName).toBe('에어아시아')
    expect(merged.outboundFlightNo).toBe('AK1624')
    expect(merged.inboundFlightNo).toBe('AK1623')
    expect(merged.departureDateTimeRaw).toBe('2026-06-28 09:20')
    expect(merged.arrivalDateTimeRaw).toBe('2026-07-02 08:20')
    expect(merged.detailBodyStructured?.flightStructured?.outbound.flightNo).toBe('AK1624')
  })
})
