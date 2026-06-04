import { describe, expect, it } from 'vitest'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import type { FitItineraryDayForKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'

describe('isRegisterAirtelListing', () => {
  it('air_hotel_free travelScope', () => {
    expect(isRegisterAirtelListing('air_hotel_free', null)).toBe(true)
  })

  it('overseas package', () => {
    expect(isRegisterAirtelListing('overseas', 'travel')).toBe(false)
  })
})

describe('mergeScheduleWithFitKeywords (register preview)', () => {
  it('fills imageKeyword from fit day activities', () => {
    const fitDays: FitItineraryDayForKeyword[] = [
      {
        dayNumber: 1,
        title: '도톤보리 산책',
        summary: '오사카 야경',
        activities: [
          {
            order: 1,
            category: 'attraction',
            title: '도톤보리',
            description: '야경',
            location: '도톤보리 (Dotonbori)',
          },
        ],
      },
    ]
    const { rows } = mergeScheduleWithFitKeywords([], fitDays, {
      cityNameKo: '오사카',
      cityKey: '',
      productTitle: '오사카 3일',
      destination: '일본',
    })
    expect(rows[0]?.imageKeyword?.length).toBeGreaterThan(2)
    expect(String(rows[0]?.title ?? '')).toContain('도톤보리')
  })
})
