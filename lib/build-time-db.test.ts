/**
 * REGRESSION-FREEZE[build-ssg-skip-db]: next build DB skip — manifest
 */
import { afterEach, describe, expect, it } from 'vitest'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'
import { resolvePrismaConnectionLimit } from '@/lib/prisma-connection-limit'

describe('build-ssg-skip-db', () => {
  const prevPhase = process.env.NEXT_PHASE

  afterEach(() => {
    if (prevPhase === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = prevPhase
  })

  it('shouldSkipDbAtBuild during phase-production-build', () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(shouldSkipDbAtBuild()).toBe(true)
    expect(shouldSkipSitemapDbAtBuild()).toBe(true)
    expect(resolvePrismaConnectionLimit()).toBe(1)
  })

  it('shouldSkipDbAtBuild false at runtime', () => {
    delete process.env.NEXT_PHASE
    expect(shouldSkipDbAtBuild()).toBe(false)
  })
})
