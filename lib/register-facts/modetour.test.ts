import { describe, expect, it } from 'vitest'
import {
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
} from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourOtherDepartureRowsToRegisterFactPriceRows } from '@/lib/register-facts/modetour'

describe('modetourOtherDepartureRowsToRegisterFactPriceRows', () => {
  it('maps in-window priced rows and skips invalid', () => {
    const rows = modetourOtherDepartureRowsToRegisterFactPriceRows(
      [
        { departureDate: '2026-06-01', minPrice: 0, pId: '1' },
        { departureDate: '2026-07-10', minPrice: 890000, pId: '99' },
        { departureDate: '2027-01-01', minPrice: 500000, pId: '2' },
      ],
      '105896067',
      '2026-06-16',
      '2026-12-13',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.departureDate).toBe('2026-07-10')
    expect(rows[0]?.supplierDepartureCode).toBe('modetour:99')
  })
})

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

  it('merges split departure/arrival items and maps ARRIVAL as inbound', () => {
    const legs = modetourFlightRoutesToFactLegs([
      {
        flightTypeName: 'DEPARTURE',
        item: [
          {
            departureCityName: '인천',
            departureDate: '2026-06-28T00:00:00',
            departureTime: '07:00',
          },
          {
            transportName: '비엣젯항공',
            arrivalCityName: '다낭',
            arrivalDate: '2026-06-28T00:00:00',
            arrivalTime: '09:40',
            departureFlight: 'VJ879',
          },
        ],
      },
      {
        flightTypeName: 'ARRIVAL',
        item: [
          {
            departureCityName: '다낭',
            departureDate: '2026-07-01T00:00:00',
            departureTime: '23:45',
          },
          {
            transportName: '비엣젯항공',
            arrivalCityName: '인천',
            arrivalDate: '2026-07-02T00:00:00',
            arrivalTime: '06:00',
            departureFlight: 'VJ878',
          },
        ],
      },
    ])
    expect(legs).toHaveLength(2)
    expect(legs[0]?.direction).toBe('outbound')
    expect(legs[0]?.flightNo).toBe('VJ879')
    expect(legs[0]?.departureAt).toBe('2026-06-28T07:00')
    expect(legs[1]?.direction).toBe('inbound')
    expect(legs[1]?.flightNo).toBe('VJ878')
    expect(legs[1]?.departureAt).toBe('2026-07-01T23:45')
  })
})
