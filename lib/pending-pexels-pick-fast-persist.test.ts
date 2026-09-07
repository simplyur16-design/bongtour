/**
 * REGRESSION-FREEZE[pending-pexels-pick-fast-persist]: persist CDN immediately; PhotoPool rehost after() — manifest
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/object-storage', () => ({
  isObjectStorageConfigured: vi.fn(() => true),
  tryParseObjectKeyFromPublicUrl: vi.fn((url: string) =>
    String(url).includes('kr.object.ncloudstorage.com') ? 'photo-pool/x.webp' : null,
  ),
  getImageStorageBucket: vi.fn(() => 'test-bucket'),
}))

vi.mock('@/lib/photo-pool', () => ({
  findPhotoPoolBySourcePhotoId: vi.fn(),
  savePhotoFromUrlWithRetry: vi.fn(),
}))

vi.mock('@/lib/travel-product-image-internalize', () => ({
  internalizeProductCoverImageUrl: vi.fn(),
}))

import { findPhotoPoolBySourcePhotoId, savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import { isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { pickPexelsDaySlotIngestUrl } from '@/lib/cover-image-quality'
import {
  rehostPendingScheduleSlotIfUnchanged,
  resolvePendingPexelsPersistUrl,
} from '@/lib/pending-pexels-pick-fast-persist'

const prisma = {
  photoPool: { findFirst: vi.fn() },
  product: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as unknown as Parameters<typeof resolvePendingPexelsPersistUrl>[0]

describe('pickPexelsDaySlotIngestUrl', () => {
  it('prefers medium over large so day-slot ingest is not original/large', () => {
    expect(
      pickPexelsDaySlotIngestUrl({
        medium: 'https://images.pexels.com/photos/1/medium.jpeg',
        large: 'https://images.pexels.com/photos/1/large.jpeg',
        thumbnail: 'https://images.pexels.com/photos/1/small.jpeg',
      }),
    ).toContain('medium')
  })
})

describe('resolvePendingPexelsPersistUrl', () => {
  beforeEach(() => {
    vi.mocked(isObjectStorageConfigured).mockReturnValue(true)
    vi.mocked(tryParseObjectKeyFromPublicUrl).mockImplementation((url: string) =>
      String(url).includes('kr.object.ncloudstorage.com') ? 'photo-pool/x.webp' : null,
    )
    vi.mocked(findPhotoPoolBySourcePhotoId).mockReset()
  })

  it('reuses PhotoPool by Pexels id without background rehost', async () => {
    vi.mocked(findPhotoPoolBySourcePhotoId).mockResolvedValue({
      filePath: 'https://kr.object.ncloudstorage.com/bucket/photo-pool/hit.webp',
    } as Awaited<ReturnType<typeof findPhotoPoolBySourcePhotoId>>)

    const r = await resolvePendingPexelsPersistUrl(
      prisma,
      'https://images.pexels.com/photos/99/x.jpeg',
      '99',
    )
    expect(r.alreadyPooled).toBe(true)
    expect(r.needsBackgroundRehost).toBe(false)
    expect(r.persistUrl).toContain('kr.object.ncloudstorage.com')
    expect(savePhotoFromUrlWithRetry).not.toHaveBeenCalled()
  })

  it('returns CDN immediately and flags after() rehost on pool miss', async () => {
    vi.mocked(findPhotoPoolBySourcePhotoId).mockResolvedValue(null)
    const cdn = 'https://images.pexels.com/photos/88/medium.jpeg'
    const r = await resolvePendingPexelsPersistUrl(prisma, cdn, '88')
    expect(r.persistUrl).toBe(cdn)
    expect(r.alreadyPooled).toBe(false)
    expect(r.needsBackgroundRehost).toBe(true)
    expect(savePhotoFromUrlWithRetry).not.toHaveBeenCalled()
  })
})

describe('rehostPendingScheduleSlotIfUnchanged', () => {
  beforeEach(() => {
    vi.mocked(savePhotoFromUrlWithRetry).mockReset()
    vi.mocked(prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset()
    vi.mocked(prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockReset()
  })

  it('replaces schedule imageUrl only when it still matches the CDN pick', async () => {
    const cdn = 'https://images.pexels.com/photos/7/medium.jpeg'
    const pooled = 'https://kr.object.ncloudstorage.com/bucket/photo-pool/day.webp'
    vi.mocked(savePhotoFromUrlWithRetry).mockResolvedValue({
      filePath: pooled,
      sourcePhotoId: '7',
    } as Awaited<ReturnType<typeof savePhotoFromUrlWithRetry>>)
    vi.mocked(prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      schedule: JSON.stringify([{ day: 1, imageUrl: cdn, imageSource: { source: 'pexels' } }]),
    })
    vi.mocked(prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const ok = await rehostPendingScheduleSlotIfUnchanged(prisma, {
      productId: 'p1',
      day: 1,
      imageSlot: 1,
      expectedCdnUrl: cdn,
      cityName: 'Osaka',
      attractionName: 'Osaka Castle',
      source: 'pexels',
      photographer: 'A',
      sourceUrl: 'https://www.pexels.com/photo/7/',
      sourcePhotoId: '7',
    })
    expect(ok).toBe(true)
    const updateArg = vi.mocked(prisma.product.update as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as { data: { schedule: string } }
    const next = JSON.parse(updateArg.data.schedule) as Array<{ imageUrl: string }>
    expect(next[0]?.imageUrl).toBe(pooled)
  })

  it('does not overwrite if the operator already picked another photo', async () => {
    vi.mocked(savePhotoFromUrlWithRetry).mockResolvedValue({
      filePath: 'https://kr.object.ncloudstorage.com/bucket/photo-pool/other.webp',
      sourcePhotoId: '7',
    } as Awaited<ReturnType<typeof savePhotoFromUrlWithRetry>>)
    vi.mocked(prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      schedule: JSON.stringify([
        { day: 1, imageUrl: 'https://images.pexels.com/photos/8/medium.jpeg', imageSource: { source: 'pexels' } },
      ]),
    })

    const ok = await rehostPendingScheduleSlotIfUnchanged(prisma, {
      productId: 'p1',
      day: 1,
      imageSlot: 1,
      expectedCdnUrl: 'https://images.pexels.com/photos/7/medium.jpeg',
      cityName: 'Osaka',
      attractionName: 'Osaka Castle',
      source: 'pexels',
      photographer: null,
      sourceUrl: null,
      sourcePhotoId: '7',
    })
    expect(ok).toBe(false)
    expect(prisma.product.update).not.toHaveBeenCalled()
  })
})
