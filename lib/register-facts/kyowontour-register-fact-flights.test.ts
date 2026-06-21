import { describe, expect, it } from 'vitest'
import { kyowontourCalendarRowsToRegisterFactFlights } from '@/lib/register-facts/kyowontour-register-fact-flights'
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'

describe('kyowontourCalendarRowsToRegisterFactFlights', () => {
  it('maps first priced row to outbound/inbound legs', () => {
    const rows: KyowontourCalendarRow[] = [
      {
        departDate: '2026-07-10',
        returnDate: '2026-07-14',
        tourCode: 'MCP160260622WS01',
        airline: '아시아나항공',
        adultPriceFromCalendar: 1290000,
        status: 'available',
        rawJson: {},
      },
    ]
    const legs = kyowontourCalendarRowsToRegisterFactFlights(rows, '인천국제공항')
    expect(legs).toHaveLength(2)
    expect(legs[0]?.carrier).toBe('아시아나항공')
    expect(legs[0]?.departureAt).toBe('2026-07-10')
    expect(legs[1]?.departureAt).toBe('2026-07-14')
  })
})
