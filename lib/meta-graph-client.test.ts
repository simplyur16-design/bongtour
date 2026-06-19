import { describe, it, expect } from 'vitest'
import {
  getMetaGraphApiBase,
  parseFacebookInsightsFromApi,
  parseInstagramInsightsFromApi,
  tokenExpiresAtFromResponse,
  FACEBOOK_POST_INSIGHT_METRICS,
} from '@/lib/meta-graph-client'
import { FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS } from '@/lib/bong-marketing/facebook-insight-utils'

describe('meta-graph-client', () => {
  it('builds graph api base with default version', () => {
    expect(getMetaGraphApiBase()).toBe('https://graph.facebook.com/v22.0')
  })

  it('parses instagram insight rows', () => {
    const parsed = parseInstagramInsightsFromApi([
      { name: 'reach', values: [{ value: 1200 }] },
      { name: 'views', values: [{ value: 3400 }] },
      { name: 'likes', values: [{ value: 88 }] },
    ])
    expect(parsed).toEqual({ reach: 1200, views: 3400, likes: 88 })
  })

  it('parses facebook Media Views / Viewers / reactions rows', () => {
    const parsed = parseFacebookInsightsFromApi([
      { name: 'post_media_view', values: [{ value: 500 }] },
      { name: 'post_total_media_view_unique', values: [{ value: 300 }] },
      { name: 'post_clicks', values: [{ value: 12 }] },
      { name: 'post_reactions_like_total', values: [{ value: 40 }] },
      { name: 'post_reactions_love_total', values: [{ value: 5 }] },
    ])
    expect(parsed.post_media_view).toBe(500)
    expect(parsed.post_total_media_view_unique).toBe(300)
    expect(parsed.post_clicks).toBe(12)
    expect(parsed.fbReactionsTotal).toBe(45)
  })

  it('does not request deprecated facebook metrics', () => {
    for (const deprecated of FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS) {
      expect(FACEBOOK_POST_INSIGHT_METRICS).not.toContain(deprecated)
    }
  })

  it('computes token expiry from expires_in', () => {
    const now = Date.now()
    const d = tokenExpiresAtFromResponse({ access_token: 'x', expires_in: 3600 })
    expect(d.getTime()).toBeGreaterThanOrEqual(now + 3590 * 1000)
    expect(d.getTime()).toBeLessThanOrEqual(now + 3601 * 1000)
  })
})
