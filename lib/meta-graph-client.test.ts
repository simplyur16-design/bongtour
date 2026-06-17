import { describe, it, expect } from 'vitest'
import {
  getMetaGraphApiBase,
  parseFacebookInsightsFromApi,
  parseInstagramInsightsFromApi,
  tokenExpiresAtFromResponse,
} from '@/lib/meta-graph-client'

describe('meta-graph-client', () => {
  it('builds graph api base with default version', () => {
    expect(getMetaGraphApiBase()).toBe('https://graph.facebook.com/v22.0')
  })

  it('parses instagram insight rows', () => {
    const parsed = parseInstagramInsightsFromApi([
      { name: 'reach', values: [{ value: 1200 }] },
      { name: 'likes', values: [{ value: 88 }] },
    ])
    expect(parsed).toEqual({ reach: 1200, likes: 88 })
  })

  it('parses facebook insight rows', () => {
    const parsed = parseFacebookInsightsFromApi([
      { name: 'post_impressions', values: [{ value: 500 }] },
      { name: 'post_impressions_unique', values: [{ value: 300 }] },
    ])
    expect(parsed).toEqual({ post_impressions: 500, post_impressions_unique: 300 })
  })

  it('computes token expiry from expires_in', () => {
    const now = Date.now()
    const d = tokenExpiresAtFromResponse({ access_token: 'x', expires_in: 3600 })
    expect(d.getTime()).toBeGreaterThanOrEqual(now + 3590 * 1000)
    expect(d.getTime()).toBeLessThanOrEqual(now + 3601 * 1000)
  })
})
