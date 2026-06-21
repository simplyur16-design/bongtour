import { describe, expect, it } from 'vitest'
import {
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
} from '@/lib/register-facts/modetour-register-fact-mappers'

describe('modetourScheduleItemsToFactDays', () => {
  it('maps place headers and hotels per day', () => {
    const days = modetourScheduleItemsToFactDays([
      {
        first: 1,
        placeHeader: ['청주', '구마모토'],
        scheduleHotel: '루트인 오무타',
        ortherActions: [
          { itiServiceName: '식사', itiSummaryDes: '기내식' },
          { itiServiceName: '관광지', itiPlaceName: '아소산' },
        ],
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.places).toEqual(expect.arrayContaining(['청주', '구마모토', '아소산']))
    expect(days[0]?.hotels).toEqual(['루트인 오무타'])
    expect(days[0]?.meals).toEqual(['기내식'])
  })
})

describe('modetourFlightRoutesToFactLegs', () => {
  it('maps departure flight rows', () => {
    const legs = modetourFlightRoutesToFactLegs([
      {
        flightTypeName: 'DEPARTURE',
        item: [
          {
            transportName: '에어서울',
            departureCityName: '청주',
            departureDate: '2026-06-21T00:00:00',
            departureTime: '08:10',
            departureFlight: 'RS741',
          },
        ],
      },
    ])
    expect(legs).toHaveLength(1)
    expect(legs[0]?.direction).toBe('outbound')
    expect(legs[0]?.carrier).toBe('에어서울')
    expect(legs[0]?.departureAt).toBe('2026-06-21T08:10')
  })
})
