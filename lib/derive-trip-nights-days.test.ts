import { describe, expect, it } from 'vitest'
import { deriveTripNightsDays, tripNightsDaysFieldsForProductWrite } from '@/lib/derive-trip-nights-days'

// REGRESSION-FREEZE[register-derive-trip-nights-days]: duration/title/schedule → tripNights/Days — manifest
describe('deriveTripNightsDays', () => {
  it('parses duration N박 M일', () => {
    expect(deriveTripNightsDays({ duration: '3박5일' })).toEqual({
      tripNights: 3,
      tripDays: 5,
      durationNormalized: '3박5일',
    })
  })

  it('falls back to title when duration empty', () => {
    const d = deriveTripNightsDays({
      duration: null,
      title: '[특가] 푸꾸옥 3박5일 #리조트',
    })
    expect(d.tripNights).toBe(3)
    expect(d.tripDays).toBe(5)
    expect(d.durationNormalized).toBe('3박 5일')
  })

  it('uses schedule day count as lower bound', () => {
    const d = deriveTripNightsDays({
      duration: '2박3일',
      scheduleDayCount: 5,
    })
    expect(d.tripDays).toBe(5)
    expect(d.tripNights).toBe(2)
  })

  it('product write keeps existing duration string', () => {
    expect(
      tripNightsDaysFieldsForProductWrite({
        duration: '4박 6일',
        title: '무시됨 3박4일',
      }),
    ).toEqual({ tripNights: 4, tripDays: 6, duration: '4박 6일' })
  })

  it('duration is always string for preview draft types', () => {
    expect(typeof tripNightsDaysFieldsForProductWrite({}).duration).toBe('string')
  })
})
