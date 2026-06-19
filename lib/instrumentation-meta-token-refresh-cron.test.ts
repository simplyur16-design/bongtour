import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runMetaTokenRefreshTick } from '@/lib/instrumentation-meta-token-refresh-cron'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bongMetaConnection: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/bong-marketing/meta-token-manager', () => ({
  shouldRefreshMetaToken: vi.fn(),
  getValidMetaConnection: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getValidMetaConnection, shouldRefreshMetaToken } from '@/lib/bong-marketing/meta-token-manager'

describe('runMetaTokenRefreshTick', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test'
    vi.mocked(prisma.bongMetaConnection.findUnique).mockReset()
    vi.mocked(shouldRefreshMetaToken).mockReset()
    vi.mocked(getValidMetaConnection).mockReset()
  })

  it('returns refreshedCount=0 when no BongMetaConnection', async () => {
    vi.mocked(prisma.bongMetaConnection.findUnique).mockResolvedValue(null)

    const result = await runMetaTokenRefreshTick()
    expect(result).toEqual({ success: true, refreshedCount: 0, errors: [] })
    expect(getValidMetaConnection).not.toHaveBeenCalled()
  })

  it('returns error when token already expired', async () => {
    vi.mocked(prisma.bongMetaConnection.findUnique).mockResolvedValue({
      provider: 'meta',
      userAccessToken: 'old',
      userTokenExpiresAt: new Date('2020-01-01'),
      lastRefreshedAt: null,
    } as never)

    const result = await runMetaTokenRefreshTick()
    expect(result.success).toBe(false)
    expect(result.errors).toContain('token_expired_reauth_required')
  })

  it('skips refresh when not within 30-day window', async () => {
    vi.mocked(prisma.bongMetaConnection.findUnique).mockResolvedValue({
      provider: 'meta',
      userAccessToken: 'tok',
      userTokenExpiresAt: new Date('2027-01-01'),
      lastRefreshedAt: new Date('2026-01-01'),
    } as never)
    vi.mocked(shouldRefreshMetaToken).mockReturnValue(false)

    const result = await runMetaTokenRefreshTick()
    expect(result).toEqual({ success: true, refreshedCount: 0, errors: [] })
    expect(getValidMetaConnection).not.toHaveBeenCalled()
  })

  it('returns refreshedCount=1 when token was refreshed', async () => {
    const before = {
      provider: 'meta' as const,
      userAccessToken: 'old-token',
      userTokenExpiresAt: new Date('2026-07-01'),
      lastRefreshedAt: new Date('2026-01-01'),
    }
    vi.mocked(prisma.bongMetaConnection.findUnique).mockResolvedValue(before as never)
    vi.mocked(shouldRefreshMetaToken).mockReturnValue(true)
    vi.mocked(getValidMetaConnection).mockResolvedValue({
      ...before,
      userAccessToken: 'new-token',
      lastRefreshedAt: new Date('2026-06-20'),
    } as never)

    const result = await runMetaTokenRefreshTick()
    expect(result).toEqual({ success: true, refreshedCount: 1, errors: [] })
    expect(getValidMetaConnection).toHaveBeenCalledTimes(1)
  })

  it('returns error when refresh window open but Graph refresh did not update token', async () => {
    vi.mocked(prisma.bongMetaConnection.findUnique).mockResolvedValue({
      provider: 'meta',
      userAccessToken: 'same',
      userTokenExpiresAt: new Date('2026-07-01'),
      lastRefreshedAt: new Date('2026-01-01'),
    } as never)
    vi.mocked(shouldRefreshMetaToken).mockReturnValue(true)
    vi.mocked(getValidMetaConnection).mockResolvedValue({
      provider: 'meta',
      userAccessToken: 'same',
      userTokenExpiresAt: new Date('2026-07-01'),
      lastRefreshedAt: new Date('2026-01-01'),
    } as never)

    const result = await runMetaTokenRefreshTick()
    expect(result.success).toBe(false)
    expect(result.errors).toContain('token_refresh_failed')
  })
})
