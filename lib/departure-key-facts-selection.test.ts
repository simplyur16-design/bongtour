import { describe, expect, it } from 'vitest'
import { pickDepartureKeyFactsForSelection, type DepartureKeyFacts } from '@/lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'
import { extractIsoDate } from '@/lib/hero-date-utils'

const septFacts: DepartureKeyFacts = {
  airline: '대한항공',
  outbound: {
    departureAirport: '인천',
    departureAtText: '2026-09-01 (화) 09:55',
    arrivalAirport: '마드리드',
    arrivalAtText: '2026-09-01 (화) 18:00',
    flightNo: 'KE913',
  },
  inbound: {
    departureAirport: '마드리드',
    departureAtText: '2026-09-09 (수) 22:25',
    arrivalAirport: '인천',
    arrivalAtText: '2026-09-10 (목) 19:25',
    flightNo: 'KE922',
  },
  outboundSummary: null,
  inboundSummary: null,
  meetingSummary: null,
}

describe('pickDepartureKeyFactsForSelection + calendar align', () => {
  it('falls back to nearest date facts then aligns times to selected calendar date', () => {
    const picked = pickDepartureKeyFactsForSelection({
      selectedDate: '2026-10-27',
      departureKeyFactsByDate: { '2026-09-01': septFacts },
    })
    expect(picked).not.toBeNull()
    const aligned = alignDepartureKeyFactsToSelectedCalendarDate(picked, '2026-10-27', {
      packageTotalDays: 10,
    })
    expect(extractIsoDate(aligned?.outbound?.departureAtText)).toBe('2026-10-27')
    expect(extractIsoDate(aligned?.inbound?.departureAtText)).toBe('2026-11-05')
    expect(aligned?.outbound?.flightNo).toBe('KE913')
  })

  it('prefers exact date key when present', () => {
    const oct: DepartureKeyFacts = {
      ...septFacts,
      outbound: {
        ...septFacts.outbound!,
        departureAtText: '2026-10-27 (화) 09:55',
        flightNo: 'KE999',
      },
    }
    const picked = pickDepartureKeyFactsForSelection({
      selectedDate: '2026-10-27',
      departureKeyFactsByDate: {
        '2026-09-01': septFacts,
        '2026-10-27': oct,
      },
    })
    expect(picked?.outbound?.flightNo).toBe('KE999')
  })
})
