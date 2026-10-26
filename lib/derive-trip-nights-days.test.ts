import { describe, expect, it } from 'vitest'
import {
  compareTripLengthMatch,
  deriveTripNightsDays,
  formatTripNightsDaysLabel,
} from '@/lib/derive-trip-nights-days'
import { composeHeroDayToken } from '@/lib/bongtour-product-display-title-ssot'
import {
  compareProductTripLengths,
  normalizeCompareDurationLabel,
} from '@/lib/similar-itinerary-compare-cluster'

describe('deriveTripNightsDays', () => {
  it('parses N박 M일 including compact 3박5일', () => {
    expect(deriveTripNightsDays({ duration: '3박5일' })).toEqual({
      tripNights: 3,
      tripDays: 5,
      label: '3박 5일',
    })
    expect(deriveTripNightsDays({ duration: '4박 5일' }).label).toBe('4박 5일')
  })

  it('days-only does not invent nights (5일 ≠ 4박 5일)', () => {
    expect(deriveTripNightsDays({ duration: '5일' })).toEqual({
      tripNights: null,
      tripDays: 5,
      label: '5일',
    })
    expect(composeHeroDayToken('5일')).toBe('5일')
    expect(composeHeroDayToken('5일')).not.toBe('4박 5일')
  })

  it('title supplies 3박5일 when duration is days-only or empty', () => {
    expect(
      deriveTripNightsDays({
        duration: '5일',
        title: '[특가] 나트랑 3박5일 #리조트',
      }),
    ).toEqual({
      tripNights: 3,
      tripDays: 5,
      label: '3박 5일',
    })
    expect(
      deriveTripNightsDays({
        duration: null,
        title: '푸꾸옥 3박5일',
      }).label,
    ).toBe('3박 5일')
  })

  it('scheduleDayCount fills days only when unknown', () => {
    const d = deriveTripNightsDays({ duration: null, scheduleDayCount: 5 })
    expect(d.tripDays).toBe(5)
    expect(d.tripNights).toBeNull()
  })

  it('compare: 3박5일 ≠ 4박5일; 5일-only ≠ 4박5일; same nights+days match', () => {
    expect(
      compareTripLengthMatch({ duration: '3박5일' }, { duration: '4박 5일' }),
    ).toBe(false)
    expect(compareTripLengthMatch({ duration: '5일' }, { duration: '4박 5일' })).toBe(false)
    expect(
      compareProductTripLengths(
        { duration: '3박5일', title: 'x' },
        { duration: '5일', title: '나트랑 3박5일' },
      ),
    ).toBe(true)
    expect(compareTripLengthMatch({ duration: '4박 5일' }, { duration: '4박5일' })).toBe(true)
  })

  it('normalizeCompareDurationLabel uses derive (no 5일→4박5일)', () => {
    expect(normalizeCompareDurationLabel('5일')).toBe('5일')
    expect(normalizeCompareDurationLabel('3박5일')).toBe('3박 5일')
    expect(normalizeCompareDurationLabel('여행안내', '상해 자유 2박3일')).toBe('2박 3일')
  })

  it('formatTripNightsDaysLabel', () => {
    expect(formatTripNightsDaysLabel(3, 5)).toBe('3박 5일')
    expect(formatTripNightsDaysLabel(null, 5)).toBe('5일')
    expect(formatTripNightsDaysLabel(null, null)).toBeNull()
  })
})
