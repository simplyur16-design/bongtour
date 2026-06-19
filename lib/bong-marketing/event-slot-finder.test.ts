import { describe, expect, it } from 'vitest'
import {
  EVENT_SLOT_INTERNATIONAL_TYPES,
  isDuplicateWithClimateCards,
  matchProductCitiesWithEvents,
  pickEventSlotMonth,
} from '@/lib/bong-marketing/event-slot-finder'
import {
  filterCountriesByRecentCollection,
  prioritizeCountriesForRefresh,
} from '@/lib/bong-marketing/curation-event-collector'

describe('event-slot-finder', () => {
  it('EVENT_SLOT types are festival and holiday only', () => {
    expect([...EVENT_SLOT_INTERNATIONAL_TYPES]).toEqual(['festival', 'holiday'])
  })

  it('isDuplicateWithClimateCards matches city+country', () => {
    expect(
      isDuplicateWithClimateCards(
        { city: '도쿄', country: '일본' },
        [{ month: 7, city: '도쿄', country: '일본' }],
      ),
    ).toBe(true)
    expect(
      isDuplicateWithClimateCards(
        { city: '오사카', country: '일본' },
        [{ month: 7, city: '도쿄', country: '일본' }],
      ),
    ).toBe(false)
  })

  it('pickEventSlotMonth finds overlapping future month', () => {
    expect(pickEventSlotMonth({ startMonth: 7, endMonth: 8 }, [6, 7, 8])).toBe(7)
    expect(pickEventSlotMonth({ startMonth: 12, endMonth: 1 }, [11, 12, 1])).toBe(12)
  })

  it('matchProductCitiesWithEvents links product city and approved festival', () => {
    const productCities = [
      { country: '일본', city: '도쿄', countrySlug: 'japan', citySlug: 'tokyo' },
      { country: '베트남', city: '다낭', countrySlug: 'vietnam', citySlug: 'danang' },
    ]
    const events = [
      {
        name: '스미다 강 불꽃대회',
        countryCode: '일본',
        city: '도쿄',
        startMonth: 7,
        endMonth: 7,
        type: 'festival',
        appealReason: '여름 불꽃',
        description: null,
      },
      {
        name: '지역 마트 행사',
        countryCode: '일본',
        city: '도쿄',
        startMonth: 7,
        endMonth: 7,
        type: 'season',
        appealReason: null,
        description: null,
      },
    ]
    const matched = matchProductCitiesWithEvents(
      productCities,
      events,
      [7, 8],
      { japan: '일본' },
      { tokyo: '도쿄' },
    )
    expect(matched).toHaveLength(1)
    expect(matched[0].eventName).toBe('스미다 강 불꽃대회')
    expect(matched[0].city).toBe('도쿄')
  })
})

describe('curation collect efficiency helpers', () => {
  it('filterCountriesByRecentCollection skips fresh countries', () => {
    const now = new Date('2026-06-15T00:00:00Z')
    const map = new Map<string, Date>([
      ['일본', new Date('2026-06-10T00:00:00Z')],
      ['베트남', new Date('2026-05-01T00:00:00Z')],
    ])
    const { included, skipped } = filterCountriesByRecentCollection(['일본', '베트남', '태국'], map, 30, now)
    expect(skipped).toEqual(['일본'])
    expect(included).toEqual(['베트남', '태국'])
  })

  it('prioritizeCountriesForRefresh puts recommendation countries first', () => {
    expect(
      prioritizeCountriesForRefresh(['체코', '일본', '베트남', '태국'], ['베트남', '일본']),
    ).toEqual(['일본', '베트남', '체코', '태국'])
  })
})
