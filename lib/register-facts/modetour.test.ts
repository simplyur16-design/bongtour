import { describe, expect, it } from 'vitest'
import {
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
} from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourOtherDepartureRowsToRegisterFactPriceRows } from '@/lib/register-facts/modetour'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

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

  it('maps 조식·중식·석식 ortherActions and otherActions alias', () => {
    const days = modetourScheduleItemsToFactDays([
      {
        first: 2,
        placeHeader: ['타이베이'],
        scheduleHotel: '호텔',
        otherActions: [
          { itiServiceName: '조식', itiSummaryDes: '호텔식' },
          { itiServiceName: '중식', itiSummaryDes: '현지식' },
          { itiServiceName: '석식', itiSummaryDes: '특식' },
        ],
      },
    ])
    const sched = modetourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.breakfastText).toMatch(/호텔식/)
    expect(sched[0]?.lunchText).toMatch(/현지식/)
    expect(sched[0]?.dinnerText).toMatch(/특식/)
  })

  it('maps combined meal summary in ortherActions', () => {
    const days = modetourScheduleItemsToFactDays([
      {
        first: 3,
        placeHeader: [],
        otherActions: [
          {
            itiServiceName: '식사',
            itiSummaryDes: '조식 호텔식, 중식 현지식, 석식 특식',
          },
        ],
      },
    ])
    const sched = modetourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.breakfastText).toMatch(/호텔식/)
    expect(sched[0]?.lunchText).toMatch(/현지식/)
    expect(sched[0]?.dinnerText).toMatch(/특식/)
  })

  it('maps GetScheduleList listMealPlace (Taiwan 105126585 shape)', () => {
    const days = modetourScheduleItemsToFactDays([
      {
        first: 1,
        listMealPlace: [
          { itiServiceName: '중식', itiSummaryDes: '기내식', itiServiceCode: 'SSCML2' },
          { itiServiceName: '석식', itiSummaryDes: '딤섬특식(딘타이펑)', itiServiceCode: 'SSCML3' },
        ],
      },
      {
        first: 2,
        listMealPlace: [
          { itiServiceName: '조식', itiSummaryDes: '호텔식', itiServiceCode: 'SSCML1' },
          { itiServiceName: '중식', itiSummaryDes: '현지식', itiServiceCode: 'SSCML2' },
          { itiServiceName: '석식', itiSummaryDes: '불고기(한식)', itiServiceCode: 'SSCML3' },
        ],
      },
      {
        first: 4,
        listMealPlace: [
          { itiServiceName: '조식', itiSummaryDes: '호텔식', itiServiceCode: 'SSCML1' },
          { itiServiceName: '중식', itiSummaryDes: '기내식', itiServiceCode: 'SSCML2' },
        ],
      },
    ])
    const d1 = modetourFactDaysToRegisterSchedule(days.filter((d) => d.day === 1))
    expect(d1[0]?.breakfastText).toBeNull()
    expect(d1[0]?.lunchText).toMatch(/기내식/)
    expect(d1[0]?.dinnerText).toMatch(/딤섬|딘타이펑/)
    const d2 = modetourFactDaysToRegisterSchedule(days.filter((d) => d.day === 2))
    expect(d2[0]?.breakfastText).toMatch(/호텔식/)
    expect(d2[0]?.lunchText).toMatch(/현지식/)
    expect(d2[0]?.dinnerText).toMatch(/불고기/)
    const d4 = modetourFactDaysToRegisterSchedule(days.filter((d) => d.day === 4))
    expect(d4[0]?.breakfastText).toMatch(/호텔식/)
    expect(d4[0]?.lunchText).toMatch(/기내식/)
    expect(d4[0]?.dinnerText).toBeNull()
  })

  it('placeHeader — 입국신고·미팅 안내 제거, 입국 도시 괄호는 도시명만', () => {
    const days = modetourScheduleItemsToFactDays([
      {
        first: 1,
        placeHeader: [
          '인천',
          '중국 모바일 사전 입국신고서 등록 방법',
          '입국 도시(상해-푸동)',
          '상해 패키지 개별 일정 불가 안내 및 현지 미팅 안내',
        ],
        scheduleHotel: '상해유적지/준4성호텔',
      },
    ])
    expect(days[0]?.places).toEqual(['인천', '상해'])
    const sched = modetourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.routeText).toBe('상해')
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
