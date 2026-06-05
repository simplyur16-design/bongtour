import { describe, expect, it } from 'vitest'
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
import {
  isRegisterAirtelListing,
  stampRegisterAirtelProductTypeOnParsed,
} from '@/lib/register-admin-airtel-listing'
import { mergeScheduleWithSingleAirtelFitKeyword } from '@/lib/fit-itinerary-merge-schedule-keywords'
import type { FitItineraryDayForKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'

describe('isRegisterAirtelListing', () => {
  it('air_hotel_free travelScope', () => {
    expect(isRegisterAirtelListing('air_hotel_free', null)).toBe(true)
  })

  it('overseas package', () => {
    expect(isRegisterAirtelListing('overseas', 'travel')).toBe(false)
  })
})

describe('stampRegisterAirtelProductTypeOnParsed', () => {
  it('sets productType air-hotel for air_hotel_free', () => {
    const out = stampRegisterAirtelProductTypeOnParsed({ productType: 'travel' }, 'air_hotel_free')
    expect(out.productType).toBe('air-hotel')
  })
})

describe('isAirHotelFitItineraryProduct', () => {
  it('accepts air-hotel productType', () => {
    expect(isAirHotelFitItineraryProduct({ productType: 'air-hotel', listingKind: null })).toBe(true)
  })

  it('accepts legacy airtel productType', () => {
    expect(isAirHotelFitItineraryProduct({ productType: 'airtel', listingKind: null })).toBe(true)
  })

  it('rejects package travel', () => {
    expect(isAirHotelFitItineraryProduct({ productType: 'travel', listingKind: 'travel' })).toBe(false)
  })
})

describe('buildAirtelRegisterScheduleRowsFromFitParsed', () => {
  it('replaces LLM schedule keywords with single fit keyword on all days', async () => {
    const { buildAirtelRegisterScheduleRowsFromFitParsed } = await import(
      '@/lib/register-airtel-fit-preview-ui'
    )
    const parsed = {
      destination: '오사카',
      schedule: [
        { day: 1, title: 'D1', description: '', imageKeyword: 'Osaka' },
        { day: 2, title: 'D2', description: '', imageKeyword: 'Osaka' },
      ],
      registerFitItineraryGeminiJson: JSON.stringify({
        title: 't',
        summary: 's',
        persona: 'mixed',
        days: [
          {
            dayNumber: 1,
            title: '도톤보리',
            summary: '도톤보리 산책.',
            dayCityKey: 'osaka',
            activities: [
              {
                order: 1,
                category: 'attraction',
                title: '도톤보리',
                description: '',
                location: '도톤보리 (Dotonbori)',
                startTime: '10:00',
                durationMinutes: 60,
                estimatedCostKrw: 0,
                estimatedCostNote: '',
                transportMode: null,
                transportDuration: null,
              },
            ],
          },
          {
            dayNumber: 2,
            title: '교토',
            summary: '청수사.',
            dayCityKey: 'kyoto',
            activities: [
              {
                order: 1,
                category: 'attraction',
                title: '청수사',
                description: '',
                location: '청수사 (Kiyomizu-dera Temple)',
                startTime: '10:00',
                durationMinutes: 60,
                estimatedCostKrw: 0,
                estimatedCostNote: '',
                transportMode: null,
                transportDuration: null,
              },
            ],
          },
        ],
      }),
    }
    const rows = buildAirtelRegisterScheduleRowsFromFitParsed(parsed)
    expect(rows?.length).toBe(2)
    const kws = rows!.map((r) => r.imageKeyword)
    expect(new Set(kws).size).toBe(1)
    expect(kws[0]).toMatch(/kiyomizu|dotonbori/i)
  })
})

describe('mergeScheduleWithSingleAirtelFitKeyword (register preview)', () => {
  it('fills same imageKeyword on all fit days', () => {
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
    const { rows, dayKeywords } = mergeScheduleWithSingleAirtelFitKeyword([], fitDays, {
      cityNameKo: '오사카',
      cityKey: '',
      productTitle: '오사카 3일',
      destination: '일본',
    })
    expect(rows[0]?.imageKeyword?.length).toBeGreaterThan(2)
    expect(String(rows[0]?.title ?? '')).toContain('도톤보리')
    expect(new Set(Object.values(dayKeywords)).size).toBe(1)
  })
})
