import { describe, expect, it } from 'vitest'
import {
  buildLottetourFlightStructuredFromFactLegs,
  lottetourCalendarRowToRegisterFactFlights,
} from '@/lib/register-facts/lottetour-register-fact-flights'
import type { LottetourCalendarRow } from '@/lib/lottetour-departures'

describe('lottetourCalendarRowToRegisterFactFlights', () => {
  it('maps calendar row to outbound/inbound with carrier and times', () => {
    const row: LottetourCalendarRow = {
      depYm: '202607',
      godId: '58808',
      evtCd: 'E26070158808KE001',
      departDate: '2026-07-01',
      returnDate: '2026-07-05',
      departTimeText: 'KE123 10:30 ~ 14:00',
      returnTimeText: 'KE124 18:00 ~ 22:30',
      carrierText: '대한항공',
      gradeText: null,
      tourTitleRaw: '방콕 5일',
      durationText: '4박 5일',
      adultPrice: 899000,
      statusRaw: null,
      seatsStatusRaw: null,
      seatCount: null,
    }
    const legs = lottetourCalendarRowToRegisterFactFlights(row, '인천국제공항 1터미널')
    expect(legs).toHaveLength(2)
    expect(legs[0]?.direction).toBe('outbound')
    expect(legs[0]?.carrier).toBe('대한항공')
    expect(legs[0]?.flightNo).toBe('KE123')
    expect(legs[0]?.departureAt).toBe('2026-07-01T10:30')
    expect(legs[1]?.direction).toBe('inbound')
    expect(legs[1]?.flightNo).toBe('KE124')
  })

  it('falls back to meeting place when calendar row missing', () => {
    const legs = lottetourCalendarRowToRegisterFactFlights(null, '김해국제공항')
    expect(legs).toHaveLength(1)
    expect(legs[0]?.departureCity).toBe('김해국제공항')
  })

  it('buildLottetourFlightStructuredFromFactLegs — prefetch SSOT', () => {
    const fs = buildLottetourFlightStructuredFromFactLegs([
      {
        direction: 'outbound',
        carrier: '대한항공',
        flightNo: 'KE485',
        departureCity: '인천공항 T2 A존',
        departureAt: '2026-07-20T19:05',
        arrivalCity: null,
        arrivalAt: '2026-07-20T22:50',
      },
      {
        direction: 'inbound',
        carrier: '대한항공',
        flightNo: 'KE486',
        departureCity: null,
        departureAt: '2026-07-24T00:10',
        arrivalCity: '인천공항 T2 A존',
        arrivalAt: '2026-07-24T07:50',
      },
    ])
    expect(fs?.airlineName).toBe('대한항공')
    expect(fs?.outbound.flightNo).toBe('KE485')
    expect(fs?.outbound.departureTime).toBe('19:05')
    expect(fs?.inbound.flightNo).toBe('KE486')
  })
})
