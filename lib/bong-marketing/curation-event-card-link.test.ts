import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  formatLinkedEventBadgeLabel,
  linkCurationEventToSeasonCard,
  listCandidateCurationEventsForCard,
  unlinkCurationEventFromSeasonCard,
} from '@/lib/bong-marketing/curation-event-card-link'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    country: { findMany: vi.fn() },
    curationEvent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    monthlyCurationContent: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'

describe('formatLinkedEventBadgeLabel', () => {
  it('formats amber pill label', () => {
    expect(
      formatLinkedEventBadgeLabel({
        name: '다낭 불꽃축제',
        countryCode: '베트남',
        startMonth: 6,
        endMonth: 7,
      }),
    ).toBe('🌐 다낭 불꽃축제 (베트남, 6~7월)')
  })
})

describe('listCandidateCurationEventsForCard', () => {
  beforeEach(() => {
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
    vi.mocked(prisma.curationEvent.findMany).mockReset()
  })

  it('returns approved events matching month and country', async () => {
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'ev-1',
        name: '다낭 불꽃축제',
        countryCode: '베트남',
        startMonth: 6,
        endMonth: 7,
        type: 'festival',
        city: '다낭',
        monthKey: '2026-07',
        monthlyCurationContentId: null,
        monthlyCurationContent: null,
      },
    ] as never)

    const events = await listCandidateCurationEventsForCard({
      monthKey: '2026-07',
      countryCode: '베트남',
    })
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('다낭 불꽃축제')
  })
})

describe('linkCurationEventToSeasonCard', () => {
  beforeEach(() => {
    vi.mocked(prisma.monthlyCurationContent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
  })

  it('links approved event and reports previous card', async () => {
    vi.mocked(prisma.monthlyCurationContent.findUnique).mockResolvedValue({ id: 'card-1' } as never)
    vi.mocked(prisma.curationEvent.findUnique)
      .mockResolvedValueOnce({
        id: 'ev-1',
        name: '축제',
        countryCode: '베트남',
        startMonth: 7,
        endMonth: 7,
        type: 'festival',
        city: null,
        monthKey: '2026-07',
        monthlyCurationContentId: 'old-card',
      } as never)
      .mockResolvedValueOnce({ status: 'approved' } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({
      id: 'ev-1',
      name: '축제',
      countryCode: '베트남',
      startMonth: 7,
      endMonth: 7,
      type: 'festival',
      city: null,
      monthKey: '2026-07',
      monthlyCurationContentId: 'card-1',
    } as never)

    const result = await linkCurationEventToSeasonCard('card-1', 'ev-1')
    expect(result.previousCardId).toBe('old-card')
    expect(prisma.curationEvent.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: { monthlyCurationContentId: 'card-1' },
      select: expect.any(Object),
    })
  })
})

describe('unlinkCurationEventFromSeasonCard', () => {
  beforeEach(() => {
    vi.mocked(prisma.curationEvent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
  })

  it('clears FK when event belongs to card', async () => {
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'ev-1',
      monthlyCurationContentId: 'card-1',
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({} as never)

    await unlinkCurationEventFromSeasonCard('card-1', 'ev-1')
    expect(prisma.curationEvent.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: { monthlyCurationContentId: null },
    })
  })
})
