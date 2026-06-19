import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  analyzeMonthCoverageGaps,
  buildCurationEventBatchPlan,
  CURATION_EVENT_COUNTRY_BATCH_SIZE,
  PRIORITY_COUNTRIES,
  getCurationEventTargetCountries,
  parseEventsWithFallback,
  refreshCurationEvents,
  sortCountriesByPriority,
} from '@/lib/bong-marketing/curation-event-collector'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { groupBy: vi.fn() },
    country: { findMany: vi.fn() },
    curationEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/bong-marketing/gemini-generate', () => ({
  generateGeminiTextResponse: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { generateGeminiTextResponse } from '@/lib/bong-marketing/gemini-generate'

describe('sortCountriesByPriority', () => {
  it('places priority countries first in defined order', () => {
    const sorted = sortCountriesByPriority(
      ['독일', '일본', '캐나다', '중국', '태국'],
      PRIORITY_COUNTRIES,
    )
    expect(sorted.slice(0, 3)).toEqual(['일본', '중국', '태국'])
    expect(sorted).toContain('독일')
    expect(sorted).toContain('캐나다')
  })

  it('sorts non-priority countries in korean locale order', () => {
    const sorted = sortCountriesByPriority(['체코', '가나'], PRIORITY_COUNTRIES)
    expect(sorted).toEqual(['가나', '체코'])
  })
})

describe('buildCurationEventBatchPlan', () => {
  it('runs priority countries as single-country calls', () => {
    const plan = buildCurationEventBatchPlan(['일본', '베트남', '체코', '폴란드', '헝가리'])
    expect(plan.filter((p) => p.mode === 'priority_single')).toHaveLength(2)
    expect(plan.find((p) => p.countries[0] === '일본')?.mode).toBe('priority_single')
    expect(plan.filter((p) => p.mode === 'batch')).toHaveLength(1)
  })
})

describe('analyzeMonthCoverageGaps', () => {
  it('flags missing critical months 1, 2, 8', () => {
    const gaps = analyzeMonthCoverageGaps(
      [
        { name: '7월만', country: '일본', startMonth: 7, endMonth: 7, type: 'festival' },
      ],
      ['일본'],
    )
    expect(gaps[0].missingCriticalMonths).toEqual([1, 2, 8])
    expect(gaps[0].missingMonths).toContain(1)
    expect(gaps[0].missingMonths).toContain(8)
  })
})

describe('parseEventsWithFallback', () => {
  it('returns coverage gaps on partial parse', () => {
    const truncated = `{
  "events": [
    {"name":"7월축제","country":"일본","startMonth":7,"endMonth":7,"type":"festival"},
    {"name":"잘림","country":"일본","startMonth":8,"endMonth":8,"type":"festival","description":"x`
    const parsed = parseEventsWithFallback(truncated, ['일본'])
    expect(parsed.partial).toBe(true)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.coverageGaps[0].missingCriticalMonths).toContain(8)
  })
})

describe('CURATION_EVENT_COUNTRY_BATCH_SIZE', () => {
  it('uses 3 countries per batch', () => {
    expect(CURATION_EVENT_COUNTRY_BATCH_SIZE).toBe(3)
  })
})

describe('getCurationEventTargetCountries', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.groupBy).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
  })

  it('prioritizes core bongtour countries before alphabetical rest', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '체코', _count: { _all: 100 } },
      { country: '일본', _count: { _all: 1 } },
      { country: '중국', _count: { _all: 1 } },
      { country: '태국', _count: { _all: 1 } },
    ] as never)

    const countries = await getCurationEventTargetCountries()
    expect(countries.indexOf('일본')).toBeLessThan(countries.indexOf('체코'))
    expect(countries.indexOf('중국')).toBeLessThan(countries.indexOf('체코'))
    expect(countries.indexOf('태국')).toBeLessThan(countries.indexOf('체코'))
  })
})

describe('refreshCurationEvents', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.groupBy).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.curationEvent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.create).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
    vi.mocked(generateGeminiTextResponse).mockReset()
  })

  it('returns empty result when no product countries', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([] as never)

    const result = await refreshCurationEvents()
    expect(result.countries).toEqual([])
    expect(result.collected).toBe(0)
    expect(result.errorDetails.some((e) => e.stage === 'no_countries')).toBe(true)
    expect(generateGeminiTextResponse).not.toHaveBeenCalled()
  })

  it('saves all events from valid JSON response', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
      { country: '베트남', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockImplementation(async ({ userPrompt }) => {
      if (userPrompt.includes('일본')) {
        return JSON.stringify({
          events: [
            {
              name: '후지 록 페스티벌',
              country: '일본',
              startMonth: 7,
              endMonth: 7,
              type: 'festival',
            },
          ],
        })
      }
      return JSON.stringify({
        events: [
          {
            name: '다낭 불꽃축제',
            country: '베트남',
            startMonth: 6,
            endMonth: 7,
            type: 'festival',
          },
        ],
      })
    })
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.curationEvent.create).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.batchesRun).toBe(2)
    expect(result.priorityCallsRun).toBe(2)
    expect(result.collected).toBe(2)
    expect(result.saved).toBe(2)
    expect(generateGeminiTextResponse).toHaveBeenCalledTimes(2)
    expect(prisma.curationEvent.create).toHaveBeenCalledTimes(2)
    expect(prisma.curationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'draft',
          marketingOnly: true,
          source: 'gemini',
        }),
      }),
    )
  })

  it('salvages partial events from truncated JSON', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(`{
  "events": [
    {
      "name": "후지 록 페스티벌",
      "country": "일본",
      "startMonth": 7,
      "endMonth": 7,
      "type": "festival"
    },
    {
      "name": "잘린 이벤트",
      "country": "일본",
      "startMonth": 8,
      "endMonth": 8,
      "type": "festival",
      "description": "unterminated`)
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.curationEvent.create).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.collected).toBe(1)
    expect(result.saved).toBe(1)
  })

  it('records parse error when response is empty', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue('not json at all')

    const result = await refreshCurationEvents()
    expect(result.collected).toBe(0)
    expect(
      result.errorDetails.some((e) => e.stage === 'json_parse' || e.stage === 'gemini_api'),
    ).toBe(true)
  })

  it('updates existing events via upsert path', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '베트남', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '다낭 불꽃축제',
            country: '베트남',
            startMonth: 6,
            endMonth: 7,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({ id: 'existing-id' } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.collected).toBe(1)
    expect(result.saved).toBe(0)
    expect(result.skippedDuplicates).toBe(1)
    expect(prisma.curationEvent.update).toHaveBeenCalledTimes(1)
    expect(prisma.curationEvent.create).not.toHaveBeenCalled()
  })

  it('skips approved rows without overwriting', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '기존 축제',
            country: '일본',
            startMonth: 1,
            endMonth: 1,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'approved-id',
      status: 'approved',
    } as never)

    const result = await refreshCurationEvents()
    expect(result.collected).toBe(1)
    expect(result.saved).toBe(0)
    expect(result.skippedApproved).toBe(1)
    expect(prisma.curationEvent.update).not.toHaveBeenCalled()
    expect(prisma.curationEvent.create).not.toHaveBeenCalled()
  })

  it('runs priority singles plus batches for mixed 30 countries', async () => {
    const thirty = [
      ...PRIORITY_COUNTRIES.slice(0, 5).map((country) => ({ country, _count: { _all: 1 } })),
      ...Array.from({ length: 25 }, (_, i) => ({
        country: `국가${i + 1}`,
        _count: { _all: 1 },
      })),
    ]
    vi.mocked(prisma.product.groupBy).mockResolvedValue(thirty as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(JSON.stringify({ events: [] }))

    const result = await refreshCurationEvents()
    expect(result.countries).toHaveLength(30)
    expect(result.priorityCallsRun).toBe(5)
    expect(result.batchesRun).toBe(5 + 9)
    expect(generateGeminiTextResponse).toHaveBeenCalledTimes(14)
  })
})
