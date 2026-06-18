import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  countryLabelsMatch,
  parseGlobalEventsResponse,
  refreshGlobalEvents,
  getBongtourProductCountries,
} from '@/lib/bong-marketing/global-event-collector'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { groupBy: vi.fn() },
    country: { findMany: vi.fn() },
    bongGlobalEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/bong-marketing/gemini-generate', () => ({
  generateGeminiJsonResponse: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'

describe('parseGlobalEventsResponse', () => {
  it('parses valid global events', () => {
    const events = parseGlobalEventsResponse({
      events: [
        {
          name: '후지 록 페스티벌',
          country: '일본',
          city: '니이가타',
          startMonth: 7,
          endMonth: 7,
          type: 'festival',
          appealReason: '여름 휴가와 맞물림',
        },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      name: '후지 록 페스티벌',
      country: '일본',
      type: 'festival',
    })
  })

  it('deduplicates by name and country', () => {
    const events = parseGlobalEventsResponse({
      events: [
        { name: '불꽃축제', country: '베트남', startMonth: 7, endMonth: 7, type: 'festival' },
        { name: '불꽃축제', country: '베트남', startMonth: 8, endMonth: 8, type: 'festival' },
      ],
    })
    expect(events).toHaveLength(1)
  })
})

describe('countryLabelsMatch', () => {
  it('matches korean country labels loosely', () => {
    expect(countryLabelsMatch('일본', '일본')).toBe(true)
    expect(countryLabelsMatch('일본 도쿄', '일본')).toBe(true)
  })
})

describe('getBongtourProductCountries', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.groupBy).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
  })

  it('uses korean labels stored directly on Product.country', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 10 } },
      { country: '베트남', _count: { _all: 5 } },
    ] as never)

    const countries = await getBongtourProductCountries()
    expect(countries).toEqual(['베트남', '일본'])
    expect(prisma.country.findMany).not.toHaveBeenCalled()
  })

  it('maps product country slugs to korean labels', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: 'japan', _count: { _all: 3 } },
      { country: 'thailand', _count: { _all: 2 } },
    ] as never)
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
      { countryKey: 'thailand', koreanLabel: '태국' },
    ] as never)

    const countries = await getBongtourProductCountries()
    expect(countries).toEqual(['일본', '태국'])
  })
})

describe('refreshGlobalEvents', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.groupBy).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.bongGlobalEvent.findFirst).mockReset()
    vi.mocked(prisma.bongGlobalEvent.create).mockReset()
    vi.mocked(prisma.bongGlobalEvent.update).mockReset()
    vi.mocked(generateGeminiJsonResponse).mockReset()
  })

  it('returns empty result when no product countries', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([] as never)

    const result = await refreshGlobalEvents()
    expect(result.countries).toEqual([])
    expect(result.collected).toBe(0)
    expect(result.errorDetails.some((e) => e.stage === 'no_countries')).toBe(true)
    expect(generateGeminiJsonResponse).not.toHaveBeenCalled()
  })

  it('collects events in country batches', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
      { country: '베트남', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiJsonResponse).mockResolvedValue({
      events: [
        {
          name: '다낭 불꽃축제',
          country: '베트남',
          startMonth: 6,
          endMonth: 7,
          type: 'festival',
        },
      ],
    } as never)
    vi.mocked(prisma.bongGlobalEvent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.bongGlobalEvent.create).mockResolvedValue({} as never)

    const result = await refreshGlobalEvents()
    expect(result.batchesRun).toBe(1)
    expect(result.collected).toBeGreaterThan(0)
    expect(result.saved).toBeGreaterThan(0)
  })
})
