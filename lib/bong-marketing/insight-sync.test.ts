import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bong-marketing/meta-token-manager', () => ({
  getValidMetaConnection: vi.fn(),
}))

vi.mock('@/lib/meta-graph-client', () => ({
  getInstagramMedia: vi.fn(),
  getInstagramMediaInsight: vi.fn(),
  getFacebookPagePosts: vi.fn(),
  getFacebookPostInsight: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bongPostInsight: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { getValidMetaConnection } from '@/lib/bong-marketing/meta-token-manager'
import {
  getFacebookPagePosts,
  getFacebookPostInsight,
  getInstagramMedia,
  getInstagramMediaInsight,
} from '@/lib/meta-graph-client'
import { prisma } from '@/lib/prisma'
import {
  backfillFacebookInsightsFromDb,
  syncAllInsights,
  syncFacebookInsights,
  syncInstagramInsights,
} from '@/lib/bong-marketing/insight-sync'
import {
  FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS,
  FACEBOOK_POST_INSIGHT_METRICS,
} from '@/lib/bong-marketing/facebook-insight-utils'

describe('insight-sync', () => {
  beforeEach(() => {
    vi.mocked(getValidMetaConnection).mockReset()
    vi.mocked(getInstagramMedia).mockReset()
    vi.mocked(getInstagramMediaInsight).mockReset()
    vi.mocked(getFacebookPagePosts).mockReset()
    vi.mocked(getFacebookPostInsight).mockReset()
    vi.mocked(prisma.bongPostInsight.upsert).mockReset()
    vi.mocked(prisma.bongPostInsight.findFirst).mockReset()
    vi.mocked(prisma.bongPostInsight.update).mockReset()
    vi.mocked(prisma.bongPostInsight.create).mockReset()
    vi.mocked(prisma.bongPostInsight.findMany).mockReset()
  })

  it('returns zero counts when meta connection missing', async () => {
    vi.mocked(getValidMetaConnection).mockResolvedValue(null)
    const result = await syncAllInsights('manual')
    expect(result).toEqual({
      instagram: { synced: 0, errors: 0 },
      facebook: { synced: 0, errors: 0 },
    })
  })

  it('syncInstagramInsights upserts instagram platform rows', async () => {
    vi.mocked(getInstagramMedia).mockResolvedValue([
      {
        id: 'ig-1',
        caption: 'hello',
        media_type: 'IMAGE',
        permalink: 'https://instagram.com/p/abc',
        timestamp: '2026-06-01T00:00:00.000Z',
      },
    ])
    vi.mocked(getInstagramMediaInsight).mockResolvedValue({
      reach: 100,
      views: 200,
      likes: 10,
      comments: 2,
    })
    vi.mocked(prisma.bongPostInsight.upsert).mockResolvedValue({} as never)

    const result = await syncInstagramInsights('ig-user', 'token', 'manual')
    expect(result).toEqual({ synced: 1, errors: 0 })
    expect(prisma.bongPostInsight.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ platform: 'instagram', instaMediaId: 'ig-1' }),
      }),
    )
  })

  it('syncFacebookInsights maps Media Viewers to reach', async () => {
    vi.mocked(getFacebookPagePosts).mockResolvedValue([
      {
        id: '354829461058288_111',
        message: 'fb post',
        permalink_url: 'https://facebook.com/354829461058288/posts/111',
        created_time: '2026-06-10T00:00:00.000Z',
        comments: { summary: { total_count: 3 } },
      },
    ])
    vi.mocked(getFacebookPostInsight).mockResolvedValue({
      post_media_view: 900,
      post_total_media_view_unique: 450,
      post_clicks: 7,
      reactions: { like: 20, love: 1 },
      fbReactionsTotal: 21,
    })
    vi.mocked(prisma.bongPostInsight.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.bongPostInsight.create).mockResolvedValue({} as never)

    const result = await syncFacebookInsights('354829461058288', 'token', 'manual')
    expect(result).toEqual({ synced: 1, errors: 0 })
    expect(prisma.bongPostInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: 'facebook',
        fbPostId: '354829461058288_111',
        reach: 450,
        impressions: 900,
        fbReactionsTotal: 21,
        comments: 3,
        websiteClicks: 7,
      }),
    })
  })

  it('does not use deprecated facebook metrics in API metric list', () => {
    for (const deprecated of FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS) {
      expect(FACEBOOK_POST_INSIGHT_METRICS).not.toContain(deprecated)
    }
  })

  it('backfillFacebookInsightsFromDb skips posts outside 28-day window', async () => {
    vi.mocked(getValidMetaConnection).mockResolvedValue({
      pageId: '354829461058288',
      pageAccessToken: 'token',
    } as never)
    vi.mocked(prisma.bongPostInsight.findMany).mockResolvedValue([
      {
        id: 'row-old',
        platform: 'facebook',
        fbPostId: '354829461058288_999',
        permalink: 'https://facebook.com/x/posts/999',
        publishedAt: new Date('2024-09-01'),
      },
    ] as never)

    const result = await backfillFacebookInsightsFromDb('manual')
    expect(result.skippedOutside28Days).toBe(1)
    expect(result.success).toBe(0)
    expect(getFacebookPostInsight).not.toHaveBeenCalled()
  })

  it('backfillFacebookInsightsFromDb syncs recent facebook rows', async () => {
    vi.mocked(getValidMetaConnection).mockResolvedValue({
      pageId: '354829461058288',
      pageAccessToken: 'token',
    } as never)
    vi.mocked(prisma.bongPostInsight.findMany).mockResolvedValue([
      {
        id: 'row-new',
        platform: 'facebook',
        fbPostId: '354829461058288_222',
        permalink: 'https://facebook.com/x/posts/222',
        caption: 'cap',
        publishedAt: new Date('2026-06-01'),
      },
    ] as never)
    vi.mocked(getFacebookPostInsight).mockResolvedValue({
      post_total_media_view_unique: 100,
      post_media_view: 200,
      fbReactionsTotal: 5,
      reactions: { like: 5 },
    })
    vi.mocked(prisma.bongPostInsight.update).mockResolvedValue({} as never)

    const result = await backfillFacebookInsightsFromDb('manual')
    expect(result.success).toBe(1)
    expect(getFacebookPostInsight).toHaveBeenCalledWith('354829461058288_222', 'token')
  })
})
