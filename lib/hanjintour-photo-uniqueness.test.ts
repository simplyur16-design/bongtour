import { describe, expect, it } from 'vitest'
import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'

function cand(id: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    source: 'Pexels',
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`,
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: `https://www.pexels.com/photo/blue-mosque-in-istanbul-${id}/`,
    altText: 'Blue Mosque in Istanbul at sunset',
    tags: [],
    ...over,
  }
}

const hanjin = (over: Partial<AcquireInput> = {}): AcquireInput => ({
  productId: 'hanjin-pending',
  kind: 'cover',
  day: null,
  sights: ['Blue Mosque'],
  cityTerms: ['istanbul'],
  destinationText: '이스탄불 터키 istanbul',
  usage: buildPublicPhotoUsage([]),
  origin: 'autofill',
  ...over,
})

describe('hanjintour photos use the public cover uniqueness gate and the photo pool', () => {
  it('한진 등록대기 대표사진은 다른 공개 상품 대표와 같으면 채택하지 않는다', async () => {
    const usage = buildPublicPhotoUsage([
      { productId: 'p-public', bgImageUrl: cand('1').url, bgImageExternalId: '1', bgImageSourceUrl: cand('1').originalLink },
    ])
    let searches = 0
    const d: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      search: async () => {
        searches += 1
        return searches === 1 ? [cand('1'), cand('2')] : []
      },
      commit: async (c) => ({
        ok: true,
        url: `https://cdn.example.com/photo-pool/${c.id}.webp`,
        bytes: 150_000,
        width: c.width,
        source: c.source,
        photographer: c.photographer ?? '',
        originalLink: c.originalLink ?? '',
        externalId: c.id,
      }),
    }
    const r = await acquireVerifiedPhoto(hanjin({ usage }), d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.externalId).toBe('2')
  })

  it('같은 장소가 사진 풀에 있으면 그 저장본을 쓰고 검색하지 않는다', async () => {
    const pooled = cand('pool-1', {
      source: 'PhotoPool',
      url: 'https://cdn.example.com/photo-pool/blue-mosque.webp',
      width: 1800,
      height: 1200,
      storedBytes: 120_000,
      altText: 'Blue Mosque in Istanbul',
    })
    let searches = 0
    const d: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      lookupPool: async () => [pooled],
      search: async () => {
        searches += 1
        return [cand('9')]
      },
      commit: async (c) => ({
        ok: true,
        url: c.url,
        bytes: c.storedBytes ?? 120_000,
        width: c.width,
        source: c.source,
        photographer: c.photographer ?? '',
        originalLink: c.originalLink ?? '',
        externalId: c.id,
      }),
    }
    const r = await acquireVerifiedPhoto(hanjin({ kind: 'day', day: 1 }), d)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.photo.url).toBe(pooled.url)
      expect(r.photo.source).toBe('PhotoPool')
    }
    expect(searches).toBe(0)
  })
})
