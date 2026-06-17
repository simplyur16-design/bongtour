import { describe, expect, it } from 'vitest'
import {
  matchEventsForMonthRange,
  parseMonthsFromMonthRange,
  parseSeasonalEventsResponse,
} from '@/lib/bong-marketing/seasonal-event-collector'

describe('parseSeasonalEventsResponse', () => {
  it('parses valid events', () => {
    const events = parseSeasonalEventsResponse({
      events: [
        {
          name: '여름 휴가 성수기',
          startMonth: 7,
          endMonth: 8,
          type: 'vacation',
        },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('여름 휴가 성수기')
  })

  it('deduplicates by name', () => {
    const events = parseSeasonalEventsResponse({
      events: [
        { name: '방학 시즌', startMonth: 7, endMonth: 8, type: 'school' },
        { name: '방학 시즌', startMonth: 1, endMonth: 2, type: 'school' },
      ],
    })
    expect(events).toHaveLength(1)
  })
})

describe('parseMonthsFromMonthRange', () => {
  it('parses single and range months', () => {
    expect(parseMonthsFromMonthRange('7월')).toEqual([7])
    expect(parseMonthsFromMonthRange('10-11월')).toEqual(expect.arrayContaining([10, 11]))
  })
})

describe('matchEventsForMonthRange', () => {
  it('matches overlapping events', () => {
    const matched = matchEventsForMonthRange('7월', [
      { name: '여름 휴가', startMonth: 7, endMonth: 8, type: 'vacation' },
      { name: '겨울 시즌', startMonth: 12, endMonth: 2, type: 'season' },
    ])
    expect(matched).toContain('여름 휴가')
    expect(matched).not.toContain('겨울 시즌')
  })
})
