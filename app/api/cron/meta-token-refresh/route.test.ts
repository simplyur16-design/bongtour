import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST } from '@/app/api/cron/meta-token-refresh/route'

vi.mock('@/lib/instrumentation-meta-token-refresh-cron', () => ({
  runMetaTokenRefreshTick: vi.fn(),
}))

import { runMetaTokenRefreshTick } from '@/lib/instrumentation-meta-token-refresh-cron'

describe('POST /api/cron/meta-token-refresh', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env, BONGTOUR_CRON_SECRET: 'test-cron-secret' }
    vi.mocked(runMetaTokenRefreshTick).mockReset()
  })

  afterEach(() => {
    process.env = env
  })

  it('GET returns 405', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
  })

  it('returns 401 when BONGTOUR_CRON_SECRET is unset', async () => {
    delete process.env.BONGTOUR_CRON_SECRET
    const res = await POST(new Request('http://localhost/api/cron/meta-token-refresh', { method: 'POST' }))
    expect(res.status).toBe(401)
    expect(runMetaTokenRefreshTick).not.toHaveBeenCalled()
  })

  it('returns 401 when cron secret header is wrong', async () => {
    const res = await POST(
      new Request('http://localhost/api/cron/meta-token-refresh', {
        method: 'POST',
        headers: { 'x-bongtour-cron-secret': 'wrong' },
      }),
    )
    expect(res.status).toBe(401)
    expect(runMetaTokenRefreshTick).not.toHaveBeenCalled()
  })

  it('returns 200 with refreshedCount on success', async () => {
    vi.mocked(runMetaTokenRefreshTick).mockResolvedValue({
      success: true,
      refreshedCount: 1,
      errors: [],
    })

    const res = await POST(
      new Request('http://localhost/api/cron/meta-token-refresh', {
        method: 'POST',
        headers: { 'x-bongtour-cron-secret': 'test-cron-secret' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      refreshedCount: number
      errors: string[]
    }
    expect(body).toEqual({ success: true, refreshedCount: 1, errors: [] })
    expect(runMetaTokenRefreshTick).toHaveBeenCalledTimes(1)
  })

  it('returns 500 with errors when tick fails', async () => {
    vi.mocked(runMetaTokenRefreshTick).mockResolvedValue({
      success: false,
      refreshedCount: 0,
      errors: ['token_refresh_failed'],
    })

    const res = await POST(
      new Request('http://localhost/api/cron/meta-token-refresh', {
        method: 'POST',
        headers: { 'x-bongtour-cron-secret': 'test-cron-secret' },
      }),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { success: boolean; errors: string[] }
    expect(body.success).toBe(false)
    expect(body.errors).toContain('token_refresh_failed')
  })
})
