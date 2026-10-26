import { describe, expect, it } from 'vitest'
import { deriveTripNightsDays, toKnownTripCount } from '@/lib/derive-trip-nights-days'
import { normalizeCompareDurationLabel } from '@/lib/similar-itinerary-compare-cluster'

/**
 * REGRESSION-FREEZE[trip-nights-null-not-zero]
 * DB tripNights/tripDays null (신규 상품 포함)은 미확정 — Number(null)=0 으로 「0박 N일」 표시 금지.
 */
describe('trip nights null is unknown, never 0', () => {
  it('DB null tripNights + days-only title → "N일", not "0박 N일" (ybtour JCC1011 shape)', () => {
    const d = deriveTripNightsDays({
      duration: '',
      title: '추석특가 이스턴 크루즈 3일 #비너스호',
      tripNights: null,
      tripDays: null,
      scheduleDayCount: 3,
    })
    expect(d).toEqual({ tripNights: null, tripDays: 3, label: '3일' })
  })

  it('null / undefined / "" / NaN nights never become 0', () => {
    for (const v of [null, undefined, '', '  ', Number.NaN, 'abc', 2.5, -1] as unknown[]) {
      const d = deriveTripNightsDays({ duration: null, scheduleDayCount: 5, tripNights: v as number | null })
      expect(d.tripNights).toBeNull()
      expect(d.label).toBe('5일')
      expect(d.label).not.toMatch(/0\s*박/)
    }
  })

  it('null schedule / tripDays do not become 0 days', () => {
    const d = deriveTripNightsDays({ duration: null, tripNights: null, tripDays: null, scheduleDayCount: null })
    expect(d).toEqual({ tripNights: null, tripDays: null, label: null })
  })

  it('real DB values still used; supplier duration keeps priority', () => {
    expect(deriveTripNightsDays({ duration: null, tripNights: 3, tripDays: 5 }).label).toBe('3박 5일')
    expect(deriveTripNightsDays({ duration: '4박 6일', tripNights: null, tripDays: null }).label).toBe('4박 6일')
    expect(deriveTripNightsDays({ duration: null, tripNights: 0, tripDays: 1 }).label).toBe('0박 1일')
  })

  it('contradictory DB 0 nights with multi-day trip stays unknown (no guessing)', () => {
    const d = deriveTripNightsDays({ duration: '', title: '오사카 4일', tripNights: 0, tripDays: null })
    expect(d).toEqual({ tripNights: null, tripDays: 4, label: '4일' })
  })

  it('compare label path also stays days-only', () => {
    expect(normalizeCompareDurationLabel('', '코타키나발루 5일 #자유일정')).toBe('5일')
  })

  it('toKnownTripCount', () => {
    expect(toKnownTripCount(null, 0)).toBeNull()
    expect(toKnownTripCount(undefined, 0)).toBeNull()
    expect(toKnownTripCount('', 0)).toBeNull()
    expect(toKnownTripCount(' 4 ', 0)).toBe(4)
    expect(toKnownTripCount(0, 0)).toBe(0)
    expect(toKnownTripCount(0, 1)).toBeNull()
  })
})