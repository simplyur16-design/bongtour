import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildEventContextBlock,
  generateMonthlyCuration,
  pickBestEventForCurationCard,
} from '@/lib/gemini-curation'
import type { ApprovedCurationEventRecord } from '@/lib/bong-marketing/curation-event-repository'

const generateContent = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyCurationContent: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    curationEvent: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/gemini-client', () => ({
  getGenAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
  })),
  getModelName: vi.fn(() => 'gemini-2.5-flash'),
  geminiTimeoutOpts: vi.fn(() => ({ timeout: 120_000 })),
}))

vi.mock('@/lib/bong-marketing/curation-event-repository', () => ({
  getApprovedCurationEventsForMonth: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getApprovedCurationEventsForMonth } from '@/lib/bong-marketing/curation-event-repository'

const SAMPLE_PRODUCT = {
  id: 'prod-1',
  title: '다낭 5일',
  primaryDestination: '다낭',
  country: '베트남',
  continent: '아시아',
  city: '다낭',
  bgImageUrl: 'https://example.com/dn.jpg',
}

const SAMPLE_EVENT: ApprovedCurationEventRecord = {
  id: 'event-1',
  name: '다낭 불꽃축제',
  countryCode: '베트남',
  city: '다낭',
  startMonth: 7,
  startDay: null,
  endMonth: 7,
  endDay: null,
  type: 'festival',
  description: '여름 밤 하늘을 수놓는 불꽃',
  appealReason: '휴가 시즌과 맞물림',
  source: 'curation_event',
  monthlyCurationContentId: null,
}

function mockGeminiRows() {
  generateContent.mockResolvedValue({
    response: {
      text: () =>
        JSON.stringify([
          {
            productId: 'prod-1',
            title: '7월의 다낭, 불꽃이 물드는 밤',
            subtitle: '여름 밤 하늘을 수놓는 불꽃의 향연',
            bodyKr:
              '다낭 불꽃축제가 열리는 시기, 해변과 도시가 하나의 빛으로 이어집니다. 바다 바람과 함께 머무는 여름밤이 특별해집니다.',
            ctaLabel: '다낭 상품 보기',
            countryCode: '베트남',
          },
        ]),
    },
  })
}

describe('buildEventContextBlock', () => {
  it('includes approved events grouped by country', () => {
    const block = buildEventContextBlock('2026-07', [SAMPLE_EVENT])
    expect(block).toContain('2026-07')
    expect(block).toContain('다낭 불꽃축제')
    expect(block).toContain('베트남:')
    expect(block).toContain('subtitle 또는 bodyKr')
  })

  it('returns empty string when pool is empty', () => {
    expect(buildEventContextBlock('2026-07', [])).toBe('')
  })
})

describe('pickBestEventForCurationCard', () => {
  it('prefers city and body keyword matches', () => {
    const picked = pickBestEventForCurationCard(
      [SAMPLE_EVENT],
      SAMPLE_PRODUCT,
      {
        productId: 'prod-1',
        title: '7월의 다낭',
        bodyKr: '다낭 불꽃축제 시즌에 맞춘 여행',
        ctaLabel: '보기',
        countryCode: '베트남',
      },
    )
    expect(picked?.id).toBe('event-1')
  })

  it('skips events already linked to another card', () => {
    const picked = pickBestEventForCurationCard(
      [{ ...SAMPLE_EVENT, monthlyCurationContentId: 'existing-card' }],
      SAMPLE_PRODUCT,
      {
        productId: 'prod-1',
        title: '7월의 다낭',
        bodyKr: '다낭 불꽃축제',
        ctaLabel: '보기',
        countryCode: '베트남',
      },
    )
    expect(picked).toBeNull()
  })
})

describe('generateMonthlyCuration', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key'
    vi.mocked(prisma.monthlyCurationContent.count).mockReset()
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
    vi.mocked(prisma.monthlyCurationContent.create).mockReset()
    vi.mocked(prisma.monthlyCurationContent.deleteMany).mockReset()
    vi.mocked(prisma.product.findMany).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
    vi.mocked(prisma.$transaction).mockReset()
    vi.mocked(getApprovedCurationEventsForMonth).mockReset()
    generateContent.mockReset()

    vi.mocked(prisma.monthlyCurationContent.count).mockResolvedValue(0)
    vi.mocked(prisma.product.findMany).mockResolvedValue([SAMPLE_PRODUCT] as never)
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([])
    mockGeminiRows()

    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const tx = {
        monthlyCurationContent: {
          deleteMany: vi.mocked(prisma.monthlyCurationContent.deleteMany),
          create: vi.fn().mockResolvedValue({ id: 'card-1' }),
        },
      }
      return cb(tx as never)
    })

    vi.mocked(prisma.monthlyCurationContent.findMany).mockResolvedValue([
      {
        id: 'card-1',
        title: '7월의 다낭, 불꽃이 물드는 밤',
        linkedProductId: 'prod-1',
        sortOrder: 0,
      },
    ] as never)
  })

  afterEach(() => {
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalGeminiKey
  })

  it('injects event pool into Gemini prompt when approved events exist', async () => {
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([SAMPLE_EVENT])

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(true)
    expect(generateContent).toHaveBeenCalledTimes(1)

    const prompt = generateContent.mock.calls[0]?.[0]?.contents?.[0]?.parts?.[0]?.text as string
    expect(prompt).toContain('다낭 불꽃축제')
    expect(prompt).toContain('참고 — 이 달(2026-07)에 열리는 주요 승인 이벤트')
  })

  it('creates cards when event pool is empty', async () => {
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([])

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(1)
    }

    const prompt = generateContent.mock.calls[0]?.[0]?.contents?.[0]?.parts?.[0]?.text as string
    expect(prompt).not.toContain('참고 — 이 달')
  })

  it('continues card creation when event pool lookup fails', async () => {
    vi.mocked(getApprovedCurationEventsForMonth).mockRejectedValue(new Error('db down'))

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(true)
  })

  it('maps CurationEvent FK to created card when match is strong', async () => {
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([SAMPLE_EVENT])
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(true)
    expect(prisma.curationEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { monthlyCurationContentId: 'card-1' },
    })
  })

  it('does not block card creation when FK mapping fails', async () => {
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([SAMPLE_EVENT])
    vi.mocked(prisma.curationEvent.update).mockRejectedValue(new Error('fk failed'))

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.created).toBe(1)
  })

  it('returns EXISTS when draft already present and overwrite is false', async () => {
    vi.mocked(prisma.monthlyCurationContent.count).mockResolvedValue(2)

    const result = await generateMonthlyCuration('2026-07')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('EXISTS')
    expect(generateContent).not.toHaveBeenCalled()
  })
})
