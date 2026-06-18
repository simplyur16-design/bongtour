import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  parseGlobalEventsResponse,
  refreshGlobalEvents,
  getBongtourProductCountries,
} from '@/lib/bong-marketing/global-event-collector'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
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

  it('returns empty for invalid payload', () => {
    expect(parseGlobalEventsResponse(null)).toEqual([])
    expect(parseGlobalEventsResponse({ events: 'bad' })).toEqual([])
  })
})

describe('getBongtourProductCountries', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
  })

  it('maps product country slugs to korean labels', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { country: 'japan' },
      { country: 'thailand' },
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
    vi.mocked(prisma.product.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.bongGlobalEvent.findFirst).mockReset()
    vi.mocked(prisma.bongGlobalEvent.create).mockReset()
    vi.mocked(prisma.bongGlobalEvent.update).mockReset()
    vi.mocked(generateGeminiJsonResponse).mockReset()
  })

  it('returns empty result when no product countries', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never)

    const result = await refreshGlobalEvents()
    expect(result).toMatchObject({
      countries: [],
      collected: 0,
      saved: 0,
      skippedDuplicates: 0,
      errors: 0,
    })
    expect(generateGeminiJsonResponse).not.toHaveBeenCalled()
  })

  it('updates existing events on duplicate name+country+year', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ country: 'japan' }] as never)
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
    ] as never)
    vi.mocked(generateGeminiJsonResponse).mockResolvedValue({
      events: [
        {
          name: '후지 록',
          country: '일본',
          startMonth: 7,
          endMonth: 7,
          type: 'festival',
        },
      ],
    } as never)
    vi.mocked(prisma.bongGlobalEvent.findFirst).mockResolvedValue({ id: 'evt-1' } as never)
    vi.mocked(prisma.bongGlobalEvent.update).mockResolvedValue({} as never)

    const result = await refreshGlobalEvents()
    expect(result.skippedDuplicates).toBe(1)
    expect(prisma.bongGlobalEvent.update).toHaveBeenCalled()
    expect(prisma.bongGlobalEvent.create).not.toHaveBeenCalled()
  })
})
