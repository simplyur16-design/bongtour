import { describe, expect, it } from 'vitest'
import {
  inferSourceKeyFromImageUrl,
  resolveCanonicalImageSourceForDisplay,
  resolveProductBgImageFieldsFromPhoto,
} from '@/lib/product-image-source-attribution'
import { resolvePublicImageSourceUserLabel } from '@/lib/public-image-overlay-ssot'
import { trailingSourceTokenFromImageUrl } from '@/lib/webp-filename'

describe('product-image-source-attribution', () => {
  it('parses PhotoPool filename with __hash suffix as Pexels', () => {
    const url =
      'https://kr.object.ncloudstorage.com/bongtour/photo-pool/%EC%8B%9C%EB%93%9C%EB%8B%88_Bondi_Beach_Pexels__mprq35fo.webp'
    expect(trailingSourceTokenFromImageUrl(url)).toBe('Pexels')
    expect(inferSourceKeyFromImageUrl(url)).toBe('pexels')
  })

  it('does not show 사진풀 when dbSource is photopool but file is Pexels', () => {
    const url =
      'https://kr.object.ncloudstorage.com/bongtour/photo-pool/Sydney_Opera_House_Pexels__abc123.webp'
    expect(
      resolvePublicImageSourceUserLabel({
        dbSource: 'photopool',
        imageUrl: url,
      })
    ).toBe('Pexels 스톡 이미지')
  })

  it('maps PhotoResult with Pexels pool source to bgImageSource pexels', () => {
    const fields = resolveProductBgImageFieldsFromPhoto({
      url: 'https://example.com/photo-pool/Sydney_Harbour_Pexels__x.webp',
      source: 'Pexels',
      photographer: 'Jane Doe',
      originalLink: 'https://www.pexels.com/photo/123/',
      externalId: '123',
    })
    expect(fields.bgImageSource).toBe('pexels')
    expect(fields.bgImagePhotographer).toBe('Jane Doe')
    expect(fields.bgImageSourceUrl).toContain('pexels.com')
  })

  it('prefers pexels.com link over photopool db key', () => {
    expect(
      resolveCanonicalImageSourceForDisplay({
        dbSource: 'photopool',
        originalLink: 'https://www.pexels.com/photo/sydney-123/',
        imageUrl: 'https://cdn.example/photo-pool/foo.webp',
      })
    ).toBe('pexels')
  })
})
