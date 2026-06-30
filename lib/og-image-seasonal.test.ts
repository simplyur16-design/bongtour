import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OG_APR_SEP_PATH,
  DEFAULT_OG_OCT_NOV_FEB_MAR_PATH,
  getOgSeasonPageKey,
  getSeasonalDefaultOgImagePath,
  kstCalendarMonth,
  staticOgPathForSeasonKey,
} from '@/lib/og-image-seasonal'
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/site-metadata'

describe('og-image-seasonal', () => {
  it('Apr–Sep → season-apr-sep static', () => {
    expect(getOgSeasonPageKey(new Date('2026-06-15T00:00:00+09:00'))).toBe('season-apr-sep')
    expect(getSeasonalDefaultOgImagePath(new Date('2026-04-01T00:00:00+09:00'))).toBe(
      DEFAULT_OG_APR_SEP_PATH,
    )
  })

  it('Oct, Nov, Feb, Mar → season-oct-nov-feb-mar static', () => {
    expect(getOgSeasonPageKey(new Date('2026-10-01T00:00:00+09:00'))).toBe('season-oct-nov-feb-mar')
    expect(getOgSeasonPageKey(new Date('2026-11-15T00:00:00+09:00'))).toBe('season-oct-nov-feb-mar')
    expect(getOgSeasonPageKey(new Date('2026-02-01T00:00:00+09:00'))).toBe('season-oct-nov-feb-mar')
    expect(getOgSeasonPageKey(new Date('2026-03-31T00:00:00+09:00'))).toBe('season-oct-nov-feb-mar')
    expect(staticOgPathForSeasonKey('season-oct-nov-feb-mar')).toBe(DEFAULT_OG_OCT_NOV_FEB_MAR_PATH)
  })

  it('Dec, Jan → season-dec-jan static', () => {
    expect(getOgSeasonPageKey(new Date('2026-12-01T00:00:00+09:00'))).toBe('season-dec-jan')
    expect(getOgSeasonPageKey(new Date('2026-01-15T00:00:00+09:00'))).toBe('season-dec-jan')
    expect(staticOgPathForSeasonKey('season-dec-jan')).toBe(DEFAULT_OG_IMAGE_PATH)
  })

  it('kstCalendarMonth respects Asia/Seoul', () => {
    expect(kstCalendarMonth(new Date('2026-04-01T15:00:00Z'))).toBe(4)
  })
})
