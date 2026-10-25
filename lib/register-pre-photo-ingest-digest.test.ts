import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const enqueueOpsSms = vi.fn()
const countRegisterPrePhotoIngestCreatedTonight = vi.fn()
const prismaCount = vi.fn()

vi.mock('@/lib/solapi-ops-sms-limiter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/solapi-ops-sms-limiter')>(
    '@/lib/solapi-ops-sms-limiter',
  )
  return {
    ...actual,
    enqueueOpsSms: (...args: unknown[]) => enqueueOpsSms(...args),
  }
})

vi.mock('@/lib/register-pre-photo-ingest-night-progress', () => ({
  countRegisterPrePhotoIngestCreatedTonight: (...args: unknown[]) =>
    countRegisterPrePhotoIngestCreatedTonight(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      count: (...args: unknown[]) => prismaCount(...args),
    },
  },
}))

vi.mock('solapi', () => ({
  SolapiMessageService: vi.fn().mockImplementation(() => ({
    sendOne: vi.fn().mockRejectedValue(new Error('solapi mock must not send')),
  })),
}))

import {
  __resetRegisterPrePhotoIngestDigestForTest,
  buildRegisterPrePhotoIngestDigestText,
  maybeSendRegisterPrePhotoIngestDigest,
  recordRegisterPrePhotoIngestDigestFromJobResult,
} from '@/lib/register-pre-photo-ingest-digest'

describe('register-pre-photo-ingest-digest', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T10:05:00+09:00'))
    __resetRegisterPrePhotoIngestDigestForTest()
    enqueueOpsSms.mockReset()
    enqueueOpsSms.mockResolvedValue({
      queued: false,
      sent: true,
      deferred: false,
      skipped: false,
      dryRun: false,
    })
    countRegisterPrePhotoIngestCreatedTonight.mockReset()
    countRegisterPrePhotoIngestCreatedTonight.mockResolvedValue({ hanatour: 2 })
    prismaCount.mockReset()
    prismaCount.mockResolvedValue(4)
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = '1'
    delete process.env.REGISTER_INGEST_DIGEST_SMS
    process.env.BONGTOUR_INSTRUMENTATION_ROLE = 'worker'
  })

  afterEach(() => {
    __resetRegisterPrePhotoIngestDigestForTest()
    vi.useRealTimers()
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST
    delete process.env.REGISTER_INGEST_DIGEST_SMS
    delete process.env.BONGTOUR_INSTRUMENTATION_ROLE
  })

  it('sends at most one digest per KST day via ops limiter', async () => {
    const a = await maybeSendRegisterPrePhotoIngestDigest({ role: 'worker' })
    const b = await maybeSendRegisterPrePhotoIngestDigest({ role: 'worker' })
    expect(a.sent).toBe(true)
    expect(b.sent).toBe(false)
    expect(b.reason).toBe('already-sent')
    expect(enqueueOpsSms).toHaveBeenCalledTimes(1)
    expect(enqueueOpsSms.mock.calls[0]![0]).toMatchObject({ kind: 'ingest-digest' })
  })

  it('digest text has no URL or phone patterns', () => {
    recordRegisterPrePhotoIngestDigestFromJobResult({
      ingest: { created: 1, failed: 1, skippedNoListing: ['x'], bySupplier: { modetour: 1 } },
      heal: { healed: 2, verified: 1, blocked: 0, failed: 0 },
    })
    const text = buildRegisterPrePhotoIngestDigestText({
      createdTonight: { modetour: 1 },
      photoKeywordBlocked: 3,
      yieldSkips: 2,
      opsDeferred: 1,
      dailyCapPrefix: null,
    })
    expect(text).not.toMatch(/https?:\/\//i)
    expect(text).not.toMatch(/www\./i)
    expect(text).not.toMatch(/01[016789]\d{7,8}/)
    expect(text).not.toMatch(/\+82/)
  })

  it('ingest off → 0 sends', async () => {
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST
    const r = await maybeSendRegisterPrePhotoIngestDigest({ role: 'worker' })
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('ingest-off')
    expect(enqueueOpsSms).not.toHaveBeenCalled()
  })

  it('REGISTER_INGEST_DIGEST_SMS=0 disables', async () => {
    process.env.REGISTER_INGEST_DIGEST_SMS = '0'
    const r = await maybeSendRegisterPrePhotoIngestDigest({ role: 'worker' })
    expect(r.sent).toBe(false)
    expect(enqueueOpsSms).not.toHaveBeenCalled()
  })

  it('web role does not send', async () => {
    const r = await maybeSendRegisterPrePhotoIngestDigest({ role: 'web' })
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('not-worker')
    expect(enqueueOpsSms).not.toHaveBeenCalled()
  })
})
