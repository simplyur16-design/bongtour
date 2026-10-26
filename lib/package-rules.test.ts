import { describe, expect, it } from 'vitest'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
import { buildCalendarSsotHeroTripDisplays } from '@/lib/product-hero-dates'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'

describe('computeReturnDate', () => {
  it('keeps KST calendar date without UTC -1 drift', () => {
    expect(computeReturnDate('2026-12-12', 3)).toBe('2026-12-14')
  })

  it('return = departure + (totalDays - 1) for N박 M일', () => {
    // 8박 10일 → totalDays 10 → return = dep + 9
    expect(computeReturnDate('2026-10-27', 10)).toBe('2026-11-05')
    expect(getProductTotalDays({ duration: '8박 10일' })).toBe(10)
  })

  it('Lotte-style: inbound earlier than departure is ignored; duration wins', () => {
    const facts: DepartureKeyFacts = {
      airline: 'TW',
      outbound: {
        departureAirport: '인천',
        departureAtText: '2026-12-28 (월) 10:00',
        arrivalAirport: null,
        arrivalAtText: null,
        flightNo: 'TW001',
      },
      // 연도 롤오버 버그로 귀국이 출발보다 앞선 경우
      inbound: {
        departureAirport: null,
        departureAtText: '2026-01-05 (월) 14:00',
        arrivalAirport: '인천',
        arrivalAtText: '2026-01-05 (월) 18:00',
        flightNo: 'TW002',
      },
      outboundSummary: null,
      inboundSummary: null,
      meetingSummary: null,
    }
    const aligned = alignDepartureKeyFactsToSelectedCalendarDate(facts, '2026-12-28', {
      packageTotalDays: 8,
    })
    const { departureDisplay, returnDisplay } = buildCalendarSsotHeroTripDisplays({
      selectedDate: '2026-12-28',
      packageTotalDays: 8,
      heroResolved: {
        departureIso: '2026-12-28',
        returnIso: '2026-01-05',
        departureSource: 'calendar',
        returnSource: 'departure_list_inbound',
      },
      computedReturnDate: computeReturnDate('2026-12-28', 8),
      departureFacts: aligned,
    })
    expect(departureDisplay).toContain('2026.12.28')
    // 8일 일정 → 귀국 2027-01-04 (duration SSOT; facts inbound 무시)
    expect(returnDisplay).toContain('2027.01.04')
  })
})
