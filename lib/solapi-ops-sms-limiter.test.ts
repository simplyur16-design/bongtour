import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendAdminOperationalLms = vi.fn()

vi.mock('@/lib/notification-service', () => ({
  sendAdminOperationalLms: (...args: unknown[]) => sendAdminOperationalLms(...args),
}))

vi.mock('solapi', () => ({
  SolapiMessageService: vi.fn().mockImplementation(() => ({
    sendOne: vi.fn().mockRejectedValue(new Error('solapi mock must not send')),
  })),
}))

import {
  __opsSmsLimiterCountersForTest,
  __opsSmsLimiterQueueDepthForTest,
  __resetOpsSmsLimiterForTest,
  enqueueOpsSms,
  getOpsSmsDailyCapDeferredCount,
  takeOpsSmsDailyCapDigestPrefix,
} from '@/lib/solapi-ops-sms-limiter'

describe('solapi-ops-sms-limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T03:00:00+09:00'))
    __resetOpsSmsLimiterForTest()
    sendAdminOperationalLms.mockReset()
    sendAdminOperationalLms.mockResolvedValue({
      skipped: false,
      dryRun: false,
      succeeded: ['01000000000'],
      failed: [],
    })
    delete process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE
    delete process.env.SOLAPI_OPS_SMS_MAX_PER_DAY
    delete process.env.SOLAPI_OPS_SMS_RETRY_MAX
    delete process.env.SOLAPI_OPS_SMS_DRY_RUN
  })

  afterEach(() => {
    __resetOpsSmsLimiterForTest()
    vi.useRealTimers()
  })

  it('defers past per-minute cap to the next minute', async () => {
    process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE = '2'
    process.env.SOLAPI_OPS_SMS_MAX_PER_DAY = '20'

    await enqueueOpsSms({ kind: 'master-integrity', text: 'a' })
    await enqueueOpsSms({ kind: 'ingest-digest', text: 'b' })
    const third = await enqueueOpsSms({ kind: 'other', text: 'c' })

    expect(third.queued).toBe(true)
    expect(third.sent).toBe(false)
    expect(sendAdminOperationalLms).toHaveBeenCalledTimes(2)
    expect(__opsSmsLimiterQueueDepthForTest()).toBe(1)

    // next KST minute
    vi.setSystemTime(new Date('2026-10-26T03:01:00+09:00'))
    await vi.advanceTimersByTimeAsync(1_000)
    await Promise.resolve()
    await Promise.resolve()

    expect(sendAdminOperationalLms).toHaveBeenCalledTimes(3)
    expect(__opsSmsLimiterQueueDepthForTest()).toBe(0)
  })

  it('stops sending on daily cap and accumulates digest summary', async () => {
    process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE = '10'
    process.env.SOLAPI_OPS_SMS_MAX_PER_DAY = '2'

    await enqueueOpsSms({ kind: 'a', text: '1' })
    await enqueueOpsSms({ kind: 'b', text: '2' })
    const third = await enqueueOpsSms({ kind: 'c', text: '3' })

    expect(third.deferred).toBe(true)
    expect(third.sent).toBe(false)
    expect(sendAdminOperationalLms).toHaveBeenCalledTimes(2)
    expect(getOpsSmsDailyCapDeferredCount()).toBe(1)

    const prefix = takeOpsSmsDailyCapDigestPrefix()
    expect(prefix).toMatch(/daily-cap deferred/)
    expect(prefix).toMatch(/c×1/)
    expect(getOpsSmsDailyCapDeferredCount()).toBe(0)
  })

  it('records failed sends after retries into digest summary', async () => {
    process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE = '5'
    process.env.SOLAPI_OPS_SMS_MAX_PER_DAY = '20'
    process.env.SOLAPI_OPS_SMS_RETRY_MAX = '2'
    sendAdminOperationalLms.mockResolvedValue({
      skipped: false,
      dryRun: false,
      succeeded: [],
      failed: [{ to: '01000000000', message: 'fail' }],
    })

    const p = enqueueOpsSms({ kind: 'fail-kind', text: 'x' })
    // retries: backoff 5s then 30s
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(30_000)
    const r = await p

    expect(r.sent).toBe(false)
    expect(r.deferred).toBe(true)
    expect(sendAdminOperationalLms).toHaveBeenCalledTimes(3)
    expect(getOpsSmsDailyCapDeferredCount()).toBe(1)
  })

  it('cap zero disables ops SMS and only digests', async () => {
    process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE = '0'
    process.env.SOLAPI_OPS_SMS_MAX_PER_DAY = '20'

    const r = await enqueueOpsSms({ kind: 'z', text: 'nope' })
    expect(r.skipped).toBe(true)
    expect(r.deferred).toBe(true)
    expect(sendAdminOperationalLms).not.toHaveBeenCalled()
    expect(getOpsSmsDailyCapDeferredCount()).toBe(1)
  })

  it('dry-run does not call sendAdminOperationalLms', async () => {
    process.env.SOLAPI_OPS_SMS_DRY_RUN = '1'
    const r = await enqueueOpsSms({ kind: 'dry', text: 'preview' })
    expect(r.sent).toBe(true)
    expect(r.dryRun).toBe(true)
    expect(sendAdminOperationalLms).not.toHaveBeenCalled()
    expect(__opsSmsLimiterCountersForTest().daySent).toBe(1)
  })

  it('customer LMS helpers do not import the ops limiter', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = process.cwd()
    const customerFiles = [
      'lib/notification-service.ts',
      'lib/bongsim/notifications/esim-qr-alimtalk.ts',
      'lib/bongsim/fulfillment/esim-delivery.ts',
      'lib/bongsim/notifications/refund-done-alimtalk.ts',
    ]
    for (const rel of customerFiles) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8')
      expect(src.includes('solapi-ops-sms-limiter'), rel).toBe(false)
    }
  })
})
