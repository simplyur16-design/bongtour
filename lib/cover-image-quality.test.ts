/**
 * REGRESSION-FREEZE[cover-image-quality]
 */
import { describe, expect, it } from 'vitest'
import {
  COVER_IMAGE_LIST_NEXT_QUALITY,
  COVER_IMAGE_WEBP_MAX_WIDTH,
  COVER_IMAGE_WEBP_QUALITY,
  pickPexelsCoverIngestUrl,
} from '@/lib/cover-image-quality'

describe('cover-image-quality', () => {
  it('cover master is sharper than legacy 1600/q82', () => {
    expect(COVER_IMAGE_WEBP_MAX_WIDTH).toBeGreaterThanOrEqual(1920)
    expect(COVER_IMAGE_WEBP_QUALITY).toBeGreaterThanOrEqual(88)
    expect(COVER_IMAGE_LIST_NEXT_QUALITY).toBeGreaterThanOrEqual(75)
  })

  it('pickPexelsCoverIngestUrl prefers original over large2x', () => {
    expect(
      pickPexelsCoverIngestUrl({
        original: 'https://images.pexels.com/photos/1/original.jpeg',
        large2x: 'https://images.pexels.com/photos/1/large2x.jpeg',
        large: 'https://images.pexels.com/photos/1/large.jpeg',
      }),
    ).toContain('original')
    expect(pickPexelsCoverIngestUrl({ large2x: 'https://x/large2x.jpg' })).toContain('large2x')
  })
})
