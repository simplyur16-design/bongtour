import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncScheduleImageKeywordsFromFitItinerary } from '@/lib/fit-itinerary-sync-schedule-image-keywords'

const findUnique = vi.fn()
const update = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}))

describe('syncScheduleImageKeywordsFromFitItinerary', () => {
  beforeEach(() => {
    findUnique.mockReset()
    update.mockReset()
  })

  it('updates schedule with single keyword on all days and clears stale imageUrl on change', async () => {
    findUnique.mockResolvedValue({
      id: 'p1',
      productType: 'airtel',
      title: '오사카3일',
      cityKey: 'osaka',
      primaryDestination: '오사카',
      destination: '오사카',
      schedule: JSON.stringify([
        {
          day: 1,
          title: 'D1',
          description: '',
          imageKeyword: 'Osaka',
          imageUrl: 'https://example.com/osaka.jpg',
        },
        {
          day: 2,
          title: 'D2',
          description: '',
          imageKeyword: 'Universal Studios Japan',
          imageUrl: 'https://example.com/usj.jpg',
        },
      ]),
    })
    update.mockResolvedValue({})

    const result = await syncScheduleImageKeywordsFromFitItinerary('p1', [
      {
        dayNumber: 1,
        title: 'Day1',
        summary: 's',
        activities: [
          {
            order: 1,
            category: 'meal',
            title: 't',
            description: '',
            location: '도톤보리 (Dotonbori)',
          },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day2',
        summary: 's',
        activities: [
          {
            order: 1,
            category: 'attraction',
            title: 't',
            description: '',
            location: '청수사 (Kiyomizu-dera Temple)',
          },
        ],
      },
    ])

    expect(result.updated).toBe(true)
    expect(result.dayKeywords[1]).toBe('Dotonbori')
    expect(result.dayKeywords[2]).toBe('Dotonbori')
    expect(update).toHaveBeenCalledTimes(1)

    const saved = JSON.parse(update.mock.calls[0]![0].data.schedule as string) as Array<{
      day: number
      imageKeyword: string
      imageUrl: string | null
    }>
    const d1 = saved.find((r) => r.day === 1)!
    const d2 = saved.find((r) => r.day === 2)!
    expect(d1.imageKeyword).toBe('Dotonbori')
    expect(d2.imageKeyword).toBe('Dotonbori')
    expect(d1.imageUrl).toBeNull()
    expect(d2.imageUrl).toBeNull()
  })

  it('skips non-airtel products', async () => {
    findUnique.mockResolvedValue({
      id: 'p2',
      productType: 'travel',
      schedule: '[]',
    })
    const result = await syncScheduleImageKeywordsFromFitItinerary('p2', [
      {
        dayNumber: 1,
        title: 't',
        summary: 's',
        activities: [],
      },
    ])
    expect(result.updated).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
