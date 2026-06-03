import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR,
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ,
  runProductDetailPayloadDailyRebuild,
} from '@/lib/product-detail-payload-daily-rebuild'

const rebuildMock = vi.fn()
const revalidateTagMock = vi.fn()
const findManyMock = vi.fn()

vi.mock('@/lib/product-public-detail/persist-payload', () => ({
  rebuildProductPublicDetailPayload: (...args: unknown[]) => rebuildMock(...args),
}))

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}))

describe('product-detail-payload-daily-rebuild', () => {
  beforeEach(() => {
    rebuildMock.mockReset()
    revalidateTagMock.mockReset()
    findManyMock.mockReset()
    rebuildMock.mockResolvedValue(true)
    findManyMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])
  })

  it('registers KST schedule constants for instrumentation', () => {
    expect(PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR).toBe('5 0 * * *')
    expect(PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ).toBe('Asia/Seoul')
  })

  it('rebuilds all registered product ids sequentially per batch', async () => {
    const result = await runProductDetailPayloadDailyRebuild({ batchSize: 2 })
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { registrationStatus: 'registered' },
      }),
    )
    expect(rebuildMock).toHaveBeenCalledTimes(3)
    expect(rebuildMock).toHaveBeenNthCalledWith(1, 'p1')
    expect(rebuildMock).toHaveBeenNthCalledWith(2, 'p2')
    expect(rebuildMock).toHaveBeenNthCalledWith(3, 'p3')
    expect(result).toMatchObject({ total: 3, ok: 3, failed: 0 })
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail-p1')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail')
  })

  it('logs failures but continues other products', async () => {
    rebuildMock.mockImplementation(async (id: string) => {
      if (id === 'p2') throw new Error('boom')
      return true
    })
    const result = await runProductDetailPayloadDailyRebuild({ batchSize: 3 })
    expect(result.ok).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.failedProductIds).toEqual(['p2'])
  })

  it('dry-run counts without calling rebuild', async () => {
    const result = await runProductDetailPayloadDailyRebuild({ dryRun: true })
    expect(result).toMatchObject({ total: 3, skipped: 3, ok: 0 })
    expect(rebuildMock).not.toHaveBeenCalled()
  })
})
