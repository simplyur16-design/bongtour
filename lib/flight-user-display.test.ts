import { describe, expect, it } from 'vitest'
import { formatFlightLegTwoLines, isPlaceholderFlightAirportLabel } from '@/lib/flight-user-display'

describe('formatFlightLegTwoLines', () => {
  it('omits em-dash airport placeholders', () => {
    const leg = formatFlightLegTwoLines({
      departureAtText: '2026-07-01 (수) 10:40',
      arrivalAtText: '2026-07-01 (수) 13:20',
      flightNo: 'TW0421',
    })
    expect(leg).not.toBeNull()
    expect(leg!.departureAirport).toBe('')
    expect(leg!.arrivalAirport).toBe('')
    expect(isPlaceholderFlightAirportLabel('—')).toBe(true)
  })
})
