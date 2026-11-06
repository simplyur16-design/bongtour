/**
 * REGRESSION-FREEZE[pending-parser-empty7-1106]: modetour ortherActions supplierText — empty7
 */
import { describe, expect, it } from 'vitest'
import { modetourScheduleItemsToFactDays } from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

describe('modetour empty7 supplierText from ortherActions', () => {
  it('keeps place names and carries itiSummaryDes for description', () => {
    const facts = modetourScheduleItemsToFactDays([
      {
        first: 3,
        placeHeader: ['마추픽추', '우루밤바'],
        scheduleHotel: '예정 호텔',
        ortherActions: [
          {
            itiServiceName: '관광',
            itiPlaceName: '마추픽추',
            itiSummaryDes: '잉카 유적 마추픽추를 방문합니다. 계단식 밭과 태양신전을 천천히 둘러봅니다.',
          },
          {
            itiServiceName: '관광',
            itiPlaceName: '오두막 전망대',
            itiSummaryDes: '오두막 전망대에서 계곡을 내려다봅니다.',
          },
        ],
      },
      {
        first: 12,
        placeHeader: [],
        scheduleHotel: '총 2개의 예정 호텔이 있습니다. 확정 되는대로 안내',
        ortherActions: [],
      },
    ])
    expect(facts[0]?.places.join(' ')).toMatch(/마추픽추/)
    expect(String(facts[0]?.supplierText ?? '')).toMatch(/마추픽추/)
    const sched = modetourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.description).toMatch(/마추픽추|잉카|전망/)
    expect(sched[1]?.title).toMatch(/예정 호텔|확정/)
  })
})
