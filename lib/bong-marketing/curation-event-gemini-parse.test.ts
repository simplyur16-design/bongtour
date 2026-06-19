import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  countryLabelsMatch,
  CURATION_EVENT_GEMINI_COUNTRY_BATCH_SIZE,
  parseGlobalEventsResponse,
  getBongtourProductCountries,
  salvageEventsFromTruncatedJson,
} from '@/lib/bong-marketing/curation-event-gemini-parse'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { groupBy: vi.fn() },
    country: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'

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

describe('salvageEventsFromTruncatedJson', () => {
  it('extracts complete event objects from truncated JSON', () => {
    const truncated = `{
  "events": [
    {
      "name": "후지 록 페스티벌",
      "country": "일본",
      "startMonth": 7,
      "endMonth": 7,
      "type": "festival"
    },
    {
      "name": "다낭 불꽃축제",
      "country": "베트남",
      "startMonth": 6,
      "endMonth": 7,
      "type": "festival",
      "description": "잘린 문자열`

    const events = salvageEventsFromTruncatedJson(truncated)
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('후지 록 페스티벌')
  })
})

describe('CURATION_EVENT_GEMINI_COUNTRY_BATCH_SIZE', () => {
  it('uses 3 countries per batch', () => {
    expect(CURATION_EVENT_GEMINI_COUNTRY_BATCH_SIZE).toBe(3)
  })
})

describe('countryLabelsMatch', () => {
  it('matches korean country labels loosely', () => {
    expect(countryLabelsMatch('일본', '일본')).toBe(true)
    expect(countryLabelsMatch('일본 도쿄', '일본')).toBe(true)
  })

  it('does not match slug to korean without variant resolution', () => {
    expect(countryLabelsMatch('japan', '일본')).toBe(false)
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
