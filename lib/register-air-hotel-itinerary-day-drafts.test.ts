import { describe, expect, it } from 'vitest'
import { buildRegisterAirHotelItineraryDayDrafts } from '@/lib/register-air-hotel-itinerary-day-drafts'

describe('buildRegisterAirHotelItineraryDayDrafts', () => {
  it('includes Fit activity transport·cost·meal in summary', () => {
    const json = JSON.stringify({
      title: 't',
      summary: 'a. b.',
      persona: 'mixed',
      days: [
        {
          dayNumber: 1,
          title: 'Day1',
          summary: '오키나와 바다를 즐겨 보세요. 택시 이동은 약 2천엔입니다.',
          dayCityKey: 'miyakojima',
          activities: [
            {
              order: 1,
              category: 'meal',
              title: '소바 맛집',
              description: '현지인 추천 메뉴',
              location: '미야코지마',
              startTime: '12:00',
              durationMinutes: 60,
              estimatedCostKrw: 18000,
              estimatedCostNote: '',
              transportMode: null,
              transportDuration: null,
            },
            {
              order: 2,
              category: 'transport',
              title: '공항 이동',
              description: '',
              location: '미야코지마',
              startTime: '09:00',
              durationMinutes: 40,
              estimatedCostKrw: 0,
              estimatedCostNote: '약 2,000엔',
              transportMode: '택시',
              transportDuration: '40분',
            },
          ],
        },
      ],
    })
    const drafts = buildRegisterAirHotelItineraryDayDrafts({
      registerFitItineraryGeminiJson: json,
      schedule: [{ day: 1, routeText: '인천 - 미야코지마', hotelText: '브리즈베이' }],
    })
    expect(drafts[0]?.meals).toMatch(/소바/)
    expect(drafts[0]?.transport).toMatch(/택시/)
    expect(drafts[0]?.summaryTextRaw).toMatch(/18000|18,000|택시/)
  })
})
