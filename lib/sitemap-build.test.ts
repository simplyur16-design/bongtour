import { describe, expect, it, afterEach } from 'vitest'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'

describe('shouldSkipSitemapDbAtBuild', () => {
  const prev = process.env.NEXT_PHASE

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = prev
  })

  it('returns true during production build phase', () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(shouldSkipSitemapDbAtBuild()).toBe(true)
  })

  it('returns false otherwise', () => {
    delete process.env.NEXT_PHASE
    expect(shouldSkipSitemapDbAtBuild()).toBe(false)
  })
})
