import { describe, it, expect } from 'vitest'
import {
  extractFacebookPostIdFromPermalink,
  FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS,
  FACEBOOK_POST_INSIGHT_METRICS,
  isFacebookPostWithin28DayInsightWindow,
  sumFacebookReactions,
} from '@/lib/bong-marketing/facebook-insight-utils'

describe('facebook-insight-utils', () => {
  it('lists Media Views metrics and excludes deprecated names', () => {
    expect(FACEBOOK_POST_INSIGHT_METRICS).toContain('post_media_view')
    expect(FACEBOOK_POST_INSIGHT_METRICS).toContain('post_total_media_view_unique')
    for (const deprecated of FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS) {
      expect(FACEBOOK_POST_INSIGHT_METRICS).not.toContain(deprecated)
    }
  })

  it('extracts fb post id from /posts/{id} permalink', () => {
    expect(
      extractFacebookPostIdFromPermalink(
        'https://www.facebook.com/354829461058288/posts/1234567890123456',
      ),
    ).toBe('354829461058288_1234567890123456')
  })

  it('extracts fb post id from story_fbid permalink', () => {
    expect(
      extractFacebookPostIdFromPermalink(
        'https://www.facebook.com/permalink.php?story_fbid=999&id=354829461058288',
      ),
    ).toBe('354829461058288_999')
  })

  it('sums reaction types', () => {
    expect(
      sumFacebookReactions({ like: 10, love: 2, wow: 1, haha: 0, sorry: 0, anger: 1 }),
    ).toBe(14)
  })

  it('detects 28-day insight window', () => {
    const now = new Date('2026-06-19T00:00:00Z')
    const recent = new Date('2026-06-01T00:00:00Z')
    const old = new Date('2026-01-01T00:00:00Z')
    expect(isFacebookPostWithin28DayInsightWindow(recent, now)).toBe(true)
    expect(isFacebookPostWithin28DayInsightWindow(old, now)).toBe(false)
  })
})
