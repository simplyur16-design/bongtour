import { describe, expect, it } from 'vitest'
import { resolvePublicDetailDateKey } from '@/lib/booking-departure-ssot'
import {
  buildCalendarSsotHeroTripDisplays,
  departureIsoFromAlignedFacts,
} from '@/lib/product-hero-dates'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'

describe('resolvePublicDetailDateKey', () => {
  const prices = [
    { id: 'july-row', date: '2026-07-01', adultPrice: 1_900_000 } as const,
  ]

  it('prefers selected row date over stale calendar key', () => {
    const key = resolvePublicDetailDateKey({
      calendarDateKey: '2026-08-05',
      selectedDepartureRowId: 'july-row',
      mergedPrices: [...prices],
      defaultDepartureRow: null,
    })
    expect(key).toBe('2026-07-01')
  })

  it('uses calendar when row missing and calendar has no price row yet', () => {
    const key = resolvePublicDetailDateKey({
      calendarDateKey: '2026-08-05',
      selectedDepartureRowId: null,
      mergedPrices: [...prices],
      defaultDepartureRow: null,
    })
    expect(key).toBe('2026-08-05')
  })
})

describe('buildCalendarSsotHeroTripDisplays', () => {
  const facts: DepartureKeyFacts = {
    airline: 'TW',
    outbound: {
      departureAirport: null,
      departureAtText: '2026-07-01 (수) 10:40',
      arrivalAirport: null,
      arrivalAtText: '2026-07-01 (수) 13:20',
      flightNo: 'TW0421',
    },
    inbound: {
      departureAirport: null,
      departureAtText: '2026-07-05 (일) 14:50',
      arrivalAirport: null,
      arrivalAtText: '2026-07-05 (일) 18:55',
      flightNo: 'TW0422',
    },
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }

  it('matches 가는편/오는편 dates in hero summary', () => {
    const aligned = alignDepartureKeyFactsToSelectedCalendarDate(facts, '2026-07-01', {
      packageTotalDays: 5,
    })
    const { departureDisplay, returnDisplay } = buildCalendarSsotHeroTripDisplays({
      selectedDate: '2026-08-05',
      packageTotalDays: 5,
      heroResolved: {
        departureIso: '2026-08-05',
        returnIso: '2026-07-05',
        departureSource: 'calendar',
        returnSource: 'departure_list_inbound',
      },
      computedReturnDate: '2026-07-05',
      departureFacts: aligned,
    })
    expect(departureIsoFromAlignedFacts(aligned)).toBe('2026-07-01')
    expect(departureDisplay).toBe('2026.07.01(수)')
    expect(returnDisplay).toBe('2026.07.05(일)')
  })
})
