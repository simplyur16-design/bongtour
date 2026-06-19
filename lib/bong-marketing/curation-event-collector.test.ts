import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  analyzeMonthCoverageGaps,
  buildCurationEventBatchPlan,
  CURATION_EVENT_COUNTRY_BATCH_SIZE,
  PRIORITY_COUNTRY_BATCH_SIZE,
  findSimilarEvent,
  normalizedEventNamesMatch,
  normalizeEventName,
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
    monthlyCurationContent: { findMany: vi.fn() },
    seasonalDestinationCuration: { findFirst: vi.fn() },
    city: { findMany: vi.fn() },
    curationEvent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

function resetCurationEventMocks() {
  vi.mocked(prisma.curationEvent.findUnique).mockReset()
  vi.mocked(prisma.curationEvent.findFirst).mockReset()
  vi.mocked(prisma.curationEvent.findMany).mockReset()
  vi.mocked(prisma.curationEvent.create).mockReset()
  vi.mocked(prisma.curationEvent.update).mockReset()
  vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.curationEvent.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([])
}

describe('normalizeEventName', () => {
  it('strips parentheses and normalizes festival spelling', () => {
    expect(normalizeEventName('옥토버페스트 (Oktoberfest)')).toBe('옥토버페스트')
    expect(normalizeEventName('후지 록 페스티벌')).toBe('후지 록 축제')
    expect(normalizeEventName('기온 마쯔리')).toBe('기온 마츠리')
  })
})

describe('normalizedEventNamesMatch', () => {
  it('matches city-prefixed and parenthetical variants', () => {
    expect(normalizedEventNamesMatch('뮌헨 옥토버페스트', '옥토버페스트 (Oktoberfest)')).toBe(
      true,
    )
    expect(
      normalizedEventNamesMatch('타이베이 101 신년 불꽃놀이', '타이베이 101 신년 맞이 불꽃놀이'),
    ).toBe(true)
  })

  it('does not match unrelated events', () => {
    expect(normalizedEventNamesMatch('옥토버페스트', '크리스마스 마켓')).toBe(false)
  })
})

describe('findSimilarEvent', () => {
  beforeEach(() => {
    resetCurationEventMocks()
  })

  it('returns exact match first', async () => {
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'exact-id',
      status: 'draft',
    } as never)

    const found = await findSimilarEvent(
      {
        name: '옥토버페스트',
        country: '독일',
        city: '뮌헨',
        startMonth: 9,
        endMonth: 10,
        type: 'festival',
      },
      2026,
    )
    expect(found?.id).toBe('exact-id')
    expect(prisma.curationEvent.findFirst).not.toHaveBeenCalled()
  })

  it('matches same city month type slot with different name', async () => {
    vi.mocked(prisma.curationEvent.findFirst).mockResolvedValue({
      id: 'slot-id',
      status: 'draft',
    } as never)

    const found = await findSimilarEvent(
      {
        name: '뮌헨 옥토버페스트',
        country: '독일',
        city: '뮌헨',
        startMonth: 9,
        endMonth: 10,
        type: 'festival',
      },
      2026,
    )
    expect(found?.id).toBe('slot-id')
  })

  it('matches normalized name among country candidates', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'name-id',
        name: '옥토버페스트',
        status: 'draft',
        startMonth: 9,
        endMonth: 10,
        type: 'festival',
      },
    ] as never)

    const found = await findSimilarEvent(
      {
        name: '뮌헨 옥토버페스트 (Oktoberfest)',
        country: '독일',
        startMonth: 9,
        endMonth: 10,
        type: 'festival',
      },
      2026,
    )
    expect(found?.id).toBe('name-id')
  })
})

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
  it('runs priority countries as 2-country pair batches', () => {
    const plan = buildCurationEventBatchPlan(['일본', '베트남', '체코', '폴란드', '헝가리'])
    expect(plan.filter((p) => p.mode === 'priority_pair')).toHaveLength(1)
    expect(plan.find((p) => p.countries.includes('일본'))?.mode).toBe('priority_pair')
    expect(plan.find((p) => p.countries.includes('일본'))?.countries).toEqual(['일본', '베트남'])
    expect(plan.filter((p) => p.mode === 'batch')).toHaveLength(1)
  })

  it('PRIORITY_COUNTRY_BATCH_SIZE is 2', () => {
    expect(PRIORITY_COUNTRY_BATCH_SIZE).toBe(2)
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
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
    vi.mocked(prisma.seasonalDestinationCuration.findFirst).mockReset()
    vi.mocked(prisma.city.findMany).mockReset()
    resetCurationEventMocks()
    vi.mocked(generateGeminiTextResponse).mockReset()
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
  })

  it('returns empty result when no product countries', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([] as never)

    const result = await refreshCurationEvents()
    expect(result.countries).toEqual([])
    expect(result.collected).toBe(0)
    expect(result.errorDetails.some((e) => e.stage === 'no_countries')).toBe(true)
    expect(generateGeminiTextResponse).not.toHaveBeenCalled()
  })

  it('skips refresh when recommendation mode has no countries', async () => {
    const result = await refreshCurationEvents({
      targetMode: 'recommendation',
      targetCountries: [],
    })
    expect(result.targetMode).toBe('recommendation')
    expect(result.countries).toEqual([])
    expect(result.errorDetails.some((e) => e.stage === 'no_countries')).toBe(true)
    expect(generateGeminiTextResponse).not.toHaveBeenCalled()
  })

  it('uses recommendation countries when targetMode is recommendation', async () => {
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '축제',
            country: '일본',
            startMonth: 7,
            endMonth: 7,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.create).mockResolvedValue({} as never)

    const result = await refreshCurationEvents({
      targetMode: 'recommendation',
      targetCountries: ['일본'],
    })
    expect(result.countries).toEqual(['일본'])
    expect(result.priorityCallsRun).toBe(1)
    expect(generateGeminiTextResponse).toHaveBeenCalledTimes(1)
  })

  it('uses priority pair batch for two priority countries', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
      { country: '베트남', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '후지 록 페스티벌',
            country: '일본',
            startMonth: 7,
            endMonth: 7,
            type: 'festival',
          },
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
    vi.mocked(prisma.curationEvent.create).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.batchesRun).toBe(1)
    expect(result.priorityCallsRun).toBe(1)
    expect(result.collected).toBe(2)
    expect(result.saved).toBe(2)
    expect(generateGeminiTextResponse).toHaveBeenCalledTimes(1)
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

  it('updates existing events via exact upsert path', async () => {
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
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'existing-id',
      status: 'draft',
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.collected).toBe(1)
    expect(result.saved).toBe(0)
    expect(result.skippedDuplicates).toBe(1)
    expect(prisma.curationEvent.update).toHaveBeenCalledTimes(1)
    expect(prisma.curationEvent.create).not.toHaveBeenCalled()
  })

  it('updates fuzzy city+month+type match instead of creating duplicate', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '독일', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '뮌헨 옥토버페스트',
            country: '독일',
            city: '뮌헨',
            startMonth: 9,
            endMonth: 10,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.findFirst).mockResolvedValue({
      id: 'slot-id',
      status: 'draft',
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.saved).toBe(0)
    expect(result.skippedDuplicates).toBe(1)
    expect(prisma.curationEvent.create).not.toHaveBeenCalled()
    expect(prisma.curationEvent.update).toHaveBeenCalledTimes(1)
  })

  it('updates fuzzy normalized name match instead of creating duplicate', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '독일', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '뮌헨 옥토버페스트 (Oktoberfest)',
            country: '독일',
            startMonth: 9,
            endMonth: 10,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'name-id',
        name: '옥토버페스트',
        status: 'draft',
        startMonth: 9,
        endMonth: 10,
        type: 'festival',
      },
    ] as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.saved).toBe(0)
    expect(result.skippedDuplicates).toBe(1)
    expect(prisma.curationEvent.create).not.toHaveBeenCalled()
  })

  it('creates when no similar event exists', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '독일', _count: { _all: 1 } },
    ] as never)
    vi.mocked(generateGeminiTextResponse).mockResolvedValue(
      JSON.stringify({
        events: [
          {
            name: '크리스마스 마켓',
            country: '독일',
            city: '뉘른베르크',
            startMonth: 12,
            endMonth: 12,
            type: 'festival',
          },
        ],
      }),
    )
    vi.mocked(prisma.curationEvent.create).mockResolvedValue({} as never)

    const result = await refreshCurationEvents()
    expect(result.saved).toBe(1)
    expect(prisma.curationEvent.create).toHaveBeenCalledTimes(1)
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

  it('runs priority pair batches plus regular batches for mixed 30 countries', async () => {
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
    expect(result.priorityCallsRun).toBe(3)
    expect(result.batchesRun).toBe(3 + 9)
    expect(generateGeminiTextResponse).toHaveBeenCalledTimes(12)
  })
})
