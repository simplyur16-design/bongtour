import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/object-storage', () => ({
  isObjectStorageConfigured: vi.fn(() => true),
  tryParseObjectKeyFromPublicUrl: vi.fn(() => null),
  getImageStorageBucket: vi.fn(() => 'test-bucket'),
  uploadStorageObject: vi.fn(),
}))

vi.mock('@/lib/photo-pool', () => ({
  savePhotoFromUrlWithRetry: vi.fn(),
}))

import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import { isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { rehostPexelsUrlsInScheduleEntries } from '@/lib/schedule-day-image-rehost'

const prisma = {} as Parameters<typeof rehostPexelsUrlsInScheduleEntries>[0]

describe('rehostPexelsUrlsInScheduleEntries', () => {
  beforeEach(() => {
    vi.mocked(isObjectStorageConfigured).mockReturnValue(true)
    vi.mocked(tryParseObjectKeyFromPublicUrl).mockImplementation((url) =>
      url.includes('kr.object.ncloudstorage.com') ? 'products/rehosted.webp' : null
    )
    vi.mocked(savePhotoFromUrlWithRetry).mockReset()
  })

  it('rehosts imageUrl2 into pool public URL', async () => {
    const pexelsUrl = 'https://images.pexels.com/photos/99/test.jpeg'
    const poolUrl = 'https://kr.object.ncloudstorage.com/bucket/products/slot2.webp'
    vi.mocked(savePhotoFromUrlWithRetry).mockResolvedValue({
      filePath: poolUrl,
      source: 'Pexels',
      photographer: 'Jane',
      sourceUrl: 'https://www.pexels.com/photo/99/',
      sourcePhotoId: '99',
    } as Awaited<ReturnType<typeof savePhotoFromUrlWithRetry>>)

    const out = await rehostPexelsUrlsInScheduleEntries(
      prisma,
      'prod-1',
      [{ day: 1, imageUrl2: pexelsUrl, imageSource2: { source: 'Pexels' } }],
      () => ({ placeName: 'Tower', cityName: 'Paris', searchKeyword: 'Paris' })
    )

    expect(out[0]?.imageUrl2).toBe(poolUrl)
    expect((out[0]?.imageSource2 as Record<string, unknown>)?.sourceImageUrl).toBe(pexelsUrl)
    expect(savePhotoFromUrlWithRetry).toHaveBeenCalledTimes(1)
  })

  it('clears imageUrl2 and preserves sourceImageUrl when pool ingest fails', async () => {
    const pexelsUrl = 'https://images.pexels.com/photos/2/test.jpeg'
    vi.mocked(savePhotoFromUrlWithRetry).mockResolvedValue(null)

    const out = await rehostPexelsUrlsInScheduleEntries(
      prisma,
      'prod-1',
      [{ day: 1, imageUrl2: pexelsUrl, imageSource2: { source: 'Pexels' } }],
      () => ({ placeName: null, cityName: 'Paris', searchKeyword: null })
    )

    expect(out[0]?.imageUrl2).toBeNull()
    const src2 = out[0]?.imageSource2 as Record<string, unknown>
    expect(src2?.sourceImageUrl).toBe(pexelsUrl)
    expect(src2?.internalizationFailed).toBe('photo-pool-ingest-failed')
  })

  it('throws when Object Storage is not configured', async () => {
    vi.mocked(isObjectStorageConfigured).mockReturnValue(false)

    await expect(
      rehostPexelsUrlsInScheduleEntries(prisma, 'prod-1', [{ day: 1 }], () => ({
        placeName: null,
        cityName: null,
        searchKeyword: null,
      }))
    ).rejects.toThrow(/Object Storage/)
  })
})
