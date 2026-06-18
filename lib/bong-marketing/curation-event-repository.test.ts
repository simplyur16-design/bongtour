import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getEventsForRecommendationMonth,
  monthOverlapsEvent,
} from '@/lib/bong-marketing/curation-event-repository'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    curationEvent: { findMany: vi.fn() },
    bongGlobalEvent: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'

describe('monthOverlapsEvent', () => {
  it('handles same-year spans', () => {
    expect(monthOverlapsEvent(7, 6, 8)).toBe(true)
    expect(monthOverlapsEvent(5, 6, 8)).toBe(false)
  })

  it('handles year-wrap spans', () => {
    expect(monthOverlapsEvent(12, 11, 2)).toBe(true)
    expect(monthOverlapsEvent(1, 11, 2)).toBe(true)
  })
})

describe('getEventsForRecommendationMonth dual-read', () => {
  beforeEach(() => {
    vi.mocked(prisma.curationEvent.findMany).mockReset()
    vi.mocked(prisma.bongGlobalEvent.findMany).mockReset()
  })

  it('returns CurationEvent rows when present', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        name: '후지 록',
        countryCode: '일본',
        city: '니이가타',
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: '여름',
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, '일본')
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('curation_event')
    expect(events[0].name).toBe('후지 록')
    expect(prisma.bongGlobalEvent.findMany).not.toHaveBeenCalled()
    expect(prisma.curationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'approved' }),
      }),
    )
  })

  it('falls back to legacy when only draft CurationEvent exists for month', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([])
    vi.mocked(prisma.bongGlobalEvent.findMany).mockResolvedValue([
      {
        name: '7월 레거시',
        country: '일본',
        city: null,
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, '일본')
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('bong_global_event')
    expect(prisma.bongGlobalEvent.findMany).toHaveBeenCalled()
  })

  it('falls back to BongGlobalEvent when CurationEvent empty for month/country', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([])
    vi.mocked(prisma.bongGlobalEvent.findMany).mockResolvedValue([
      {
        name: '다낭 불꽃',
        country: '베트남',
        city: '다낭',
        startMonth: 6,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: '휴가',
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, '베트남')
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('bong_global_event')
    expect(prisma.bongGlobalEvent.findMany).toHaveBeenCalled()
  })

  it('prefers CurationEvent when both tables have data', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        name: '신규 이벤트',
        countryCode: '일본',
        city: null,
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)
    vi.mocked(prisma.bongGlobalEvent.findMany).mockResolvedValue([
      {
        name: '레거시 이벤트',
        country: '일본',
        city: null,
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, '일본')
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('curation_event')
    expect(events[0].name).toBe('신규 이벤트')
    expect(prisma.bongGlobalEvent.findMany).not.toHaveBeenCalled()
  })

  it('uses legacy when CurationEvent exists but not for target month', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        name: '8월만',
        countryCode: '일본',
        city: null,
        startMonth: 8,
        startDay: null,
        endMonth: 8,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)
    vi.mocked(prisma.bongGlobalEvent.findMany).mockResolvedValue([
      {
        name: '7월 레거시',
        country: '일본',
        city: null,
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, '일본')
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('bong_global_event')
    expect(events[0].name).toBe('7월 레거시')
  })
})
