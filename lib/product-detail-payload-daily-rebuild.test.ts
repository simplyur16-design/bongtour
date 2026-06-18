import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterStaleDetailPayloadProductIds,
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR,
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ,
  runProductDetailPayloadDailyRebuild,
} from '@/lib/product-detail-payload-daily-rebuild'

const rebuildMock = vi.fn()
const revalidateTagMock = vi.fn()
const findManyMock = vi.fn()
const dtoHitMock = vi.fn()

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

vi.mock('@/lib/product-detail-payload-hit', () => ({
  productDetailPayloadDtoHit: (...args: unknown[]) => dtoHitMock(...args),
}))

describe('product-detail-payload-daily-rebuild', () => {
  const baseDate = new Date('2026-06-20T00:00:00+09:00')

  beforeEach(() => {
    rebuildMock.mockReset()
    revalidateTagMock.mockReset()
    findManyMock.mockReset()
    dtoHitMock.mockReset()
    rebuildMock.mockResolvedValue(true)
    findManyMock.mockResolvedValue([
      { id: 'p1', publicDetailPayloadJson: '{"v":1}' },
      { id: 'p2', publicDetailPayloadJson: '{"v":2}' },
      { id: 'p3', publicDetailPayloadJson: null },
    ])
    dtoHitMock.mockImplementation((json: string | null) => json === '{"v":1}')
  })

  it('registers KST schedule constants for instrumentation', () => {
    expect(PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR).toBe('5 0 * * *')
    expect(PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ).toBe('Asia/Seoul')
  })

  it('does nothing when no stale payloads', async () => {
    dtoHitMock.mockReturnValue(true)
    const result = await runProductDetailPayloadDailyRebuild({ baseDate, batchSleepMs: 0 })
    expect(rebuildMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ registeredTotal: 3, staleTotal: 0, ok: 0 })
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it('rebuilds only stale product ids', async () => {
    const result = await runProductDetailPayloadDailyRebuild({
      baseDate,
      batchSize: 2,
      batchSleepMs: 0,
    })
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { registrationStatus: 'registered' },
        select: { id: true, publicDetailPayloadJson: true },
      }),
    )
    expect(rebuildMock).toHaveBeenCalledTimes(2)
    expect(rebuildMock).toHaveBeenNthCalledWith(1, 'p2')
    expect(rebuildMock).toHaveBeenNthCalledWith(2, 'p3')
    expect(result).toMatchObject({ registeredTotal: 3, staleTotal: 2, ok: 2, failed: 0 })
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail-p2')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail')
  })

  it('filterStaleDetailPayloadProductIds uses productDetailPayloadDtoHit with baseDate', () => {
    const rows = [
      { id: 'fresh', publicDetailPayloadJson: '{"bookableMinDateYmd":"2026-06-20"}' },
      { id: 'stale', publicDetailPayloadJson: '{"bookableMinDateYmd":"2026-06-12"}' },
    ]
    dtoHitMock.mockImplementation((json: string | null) => {
      return json?.includes('2026-06-20') === true
    })
    expect(filterStaleDetailPayloadProductIds(rows, baseDate)).toEqual(['stale'])
    expect(dtoHitMock).toHaveBeenCalledWith(rows[0]!.publicDetailPayloadJson, baseDate)
    expect(dtoHitMock).toHaveBeenCalledWith(rows[1]!.publicDetailPayloadJson, baseDate)
  })

  it('logs failures but continues other products', async () => {
    rebuildMock.mockImplementation(async (id: string) => {
      if (id === 'p2') throw new Error('boom')
      return true
    })
    const result = await runProductDetailPayloadDailyRebuild({ baseDate, batchSize: 3, batchSleepMs: 0 })
    expect(result.ok).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failedProductIds).toEqual(['p2'])
  })

  it('dry-run counts stale without calling rebuild', async () => {
    const result = await runProductDetailPayloadDailyRebuild({ baseDate, dryRun: true })
    expect(result).toMatchObject({ registeredTotal: 3, staleTotal: 2, skipped: 2, ok: 0 })
    expect(rebuildMock).not.toHaveBeenCalled()
  })
})
