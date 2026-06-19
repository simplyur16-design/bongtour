import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildCountryMatchVariants,
  getApprovedCurationEventsForMonth,
  getEventsForRecommendationMonth,
  monthOverlapsEvent,
  resolveRecommendationEventYear,
} from '@/lib/bong-marketing/curation-event-repository'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    curationEvent: { findMany: vi.fn() },
    bongGlobalEvent: { findMany: vi.fn() },
    country: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'

describe('resolveRecommendationEventYear', () => {
  it('uses current year for same-year future months', () => {
    expect(resolveRecommendationEventYear(7, new Date('2026-06-15'))).toBe(2026)
  })

  it('uses next year for wrapped months before current month', () => {
    expect(resolveRecommendationEventYear(1, new Date('2026-06-15'))).toBe(2027)
  })
})

describe('buildCountryMatchVariants', () => {
  it('maps slug recommendation to korean label variant', () => {
    const variants = buildCountryMatchVariants('japan', { japan: '일본' })
    expect(variants).toContain('japan')
    expect(variants).toContain('일본')
  })

  it('maps korean recommendation to slug variant', () => {
    const variants = buildCountryMatchVariants('일본', { japan: '일본' })
    expect(variants).toContain('japan')
    expect(variants).toContain('일본')
  })
})

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

describe('getApprovedCurationEventsForMonth', () => {
  beforeEach(() => {
    vi.mocked(prisma.curationEvent.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
  })

  it('returns approved events overlapping monthKey without legacy fallback', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'ev-1',
        name: '다낭 불꽃축제',
        countryCode: '베트남',
        city: '다낭',
        startMonth: 6,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: '여름 불꽃',
        appealReason: null,
        monthlyCurationContentId: null,
      },
    ] as never)

    const events = await getApprovedCurationEventsForMonth('2026-07')
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('ev-1')
    expect(events[0].source).toBe('curation_event')
    expect(prisma.curationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { year: 2026, status: 'approved' },
      }),
    )
  })

  it('filters by countryCode when provided', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'ev-jp',
        name: '기온 마츠리',
        countryCode: '일본',
        city: '교토',
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
        monthlyCurationContentId: null,
      },
      {
        id: 'ev-vn',
        name: '다낭 불꽃축제',
        countryCode: '베트남',
        city: '다낭',
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
        monthlyCurationContentId: null,
      },
    ] as never)

    const events = await getApprovedCurationEventsForMonth('2026-07', '베트남')
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('다낭 불꽃축제')
  })

  it('returns empty array for invalid monthKey', async () => {
    const events = await getApprovedCurationEventsForMonth('invalid')
    expect(events).toEqual([])
    expect(prisma.curationEvent.findMany).not.toHaveBeenCalled()
  })
})

describe('getEventsForRecommendationMonth dual-read', () => {
  beforeEach(() => {
    vi.mocked(prisma.curationEvent.findMany).mockReset()
    vi.mocked(prisma.bongGlobalEvent.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
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

    const events = await getEventsForRecommendationMonth(7, '일본', {
      referenceDate: new Date('2026-06-15'),
    })
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('curation_event')
    expect(events[0].name).toBe('후지 록')
    expect(prisma.bongGlobalEvent.findMany).not.toHaveBeenCalled()
    expect(prisma.curationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'approved', year: 2026 }),
      }),
    )
  })

  it('matches slug country from Gemini against korean countryCode', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        name: '기온 마츠리',
        countryCode: '일본',
        city: '교토',
        startMonth: 7,
        startDay: null,
        endMonth: 7,
        endDay: null,
        type: 'festival',
        description: null,
        appealReason: null,
      },
    ] as never)

    const events = await getEventsForRecommendationMonth(7, 'japan', {
      countryLabels: { japan: '일본' },
      referenceDate: new Date('2026-06-15'),
    })
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('기온 마츠리')
    expect(prisma.bongGlobalEvent.findMany).not.toHaveBeenCalled()
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

    const events = await getEventsForRecommendationMonth(7, '일본', {
      referenceDate: new Date('2026-06-15'),
    })
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

    const events = await getEventsForRecommendationMonth(7, '베트남', {
      referenceDate: new Date('2026-06-15'),
    })
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

    const events = await getEventsForRecommendationMonth(7, '일본', {
      referenceDate: new Date('2026-06-15'),
    })
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

    const events = await getEventsForRecommendationMonth(7, '일본', {
      referenceDate: new Date('2026-06-15'),
    })
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('bong_global_event')
    expect(events[0].name).toBe('7월 레거시')
  })
})
