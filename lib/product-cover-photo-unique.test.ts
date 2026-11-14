import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  coverFallbackPlaceQueries,
  coverPhotoKeys,
  createCoverPhotoUsage,
  loadCoverPhotoUsage,
} from './product-cover-photo-unique'

const NC = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/'

describe('coverPhotoKeys', () => {
  it('pool file names carry the Pexels id', () => {
    expect(coverPhotoKeys({ url: `${NC}%EC%98%A4%EC%82%AC%EC%B9%B4_Kiyomizu-dera_33198749_card_Pexels__mwfw8ngk.webp` })).toContain(
      'pexels:33198749',
    )
    expect(coverPhotoKeys({ url: `${NC}pkg-vg-0100_D3_pexels-32419675_b01r2.webp` })).toContain('pexels:32419675')
  })

  it('short slot numbers are not ids', () => {
    const keys = coverPhotoKeys({ url: `${NC}%EC%98%A4%EC%82%AC%EC%B9%B4_%EC%98%A4%EC%82%AC%EC%B9%B4_2_Pexels__mvzbx9vo.webp` })
    expect(keys.some((k) => k.startsWith('pexels:'))).toBe(false)
  })

  it('reads CDN, page link and external id', () => {
    expect(coverPhotoKeys({ url: 'https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg?w=1920' })).toContain(
      'pexels:1234567',
    )
    expect(coverPhotoKeys({ originalLink: 'https://www.pexels.com/photo/temple-at-dusk-7654321/' })).toContain('pexels:7654321')
    expect(coverPhotoKeys({ externalId: '7654321' })).toContain('pexels:7654321')
    expect(coverPhotoKeys({ originalLink: 'https://unsplash.com/photos/kyoto-street-AbCdEfGhIjK' })).toContain(
      'unsplash:AbCdEfGhIjK',
    )
  })
})

describe('createCoverPhotoUsage', () => {
  it('same file with different encoding or query counts as used', () => {
    const u = createCoverPhotoUsage([{ url: `${NC}%EB%8B%A4%EB%82%AD_x.webp` }])
    expect(u.isUsed({ url: `${NC}다낭_x.webp?v=2` })).toBe(true)
  })

  it('same Pexels photo uploaded under another file name counts as used', () => {
    const u = createCoverPhotoUsage([{ url: `${NC}a_Grand_Palace_11105014_card_Pexels__aaa.webp` }])
    expect(u.isUsed({ url: 'https://images.pexels.com/photos/11105014/pexels-photo-11105014.jpeg' })).toBe(true)
    expect(u.isUsed({ url: `${NC}b.webp`, externalId: '11105014' })).toBe(true)
    expect(u.isUsed({ url: `${NC}c.webp`, externalId: '99999999' })).toBe(false)
  })
})

describe('loadCoverPhotoUsage', () => {
  it('reads registered and pending covers, excluding the product itself', async () => {
    const findMany = vi.fn().mockResolvedValue([{ bgImageUrl: `${NC}x.webp`, bgImageExternalId: null, bgImageSourceUrl: null }])
    const u = await loadCoverPhotoUsage({ product: { findMany } } as never, { excludeProductId: 'p1' })
    const where = findMany.mock.calls[0]![0].where
    expect(where.id).toEqual({ not: 'p1' })
    expect(where.OR).toEqual(
      expect.arrayContaining([{ registrationStatus: 'registered' }, { registrationStatus: 'pending' }]),
    )
    expect(u.isUsed({ url: `${NC}x.webp` })).toBe(true)
  })
})

describe('coverFallbackPlaceQueries', () => {
  it('uses itinerary places, never the city name or placeholders', () => {
    expect(
      coverFallbackPlaceQueries('Kiyomizu-dera', ['day_1', 'Osaka', 'Kiyomizu-dera', 'Fushimi Inari', 'Arashiyama', 'Nara Park'], [
        '오사카',
        'Osaka',
      ]),
    ).toEqual(['Fushimi Inari', 'Arashiyama'])
  })
})

describe('process-images cover wiring', () => {
  const src = fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')
  it('loads other covers and filters pool, pre-made, cache and chain main picks', () => {
    expect(src).toContain('loadCoverPhotoUsage(prisma, { excludeProductId: String(product.id) })')
    expect(src).toMatch(/poolList\.findIndex\(\(rec\) => !otherCovers\.isUsed/)
    expect(src).toMatch(/!otherCovers\.isUsed\(\{ url: preMadeRaw\.mainPhoto\.url/)
    expect(src).toMatch(/poolMainRaw && !otherCovers\.isUsed/)
    expect(src).toMatch(/cachedMainRaw && !otherCovers\.isUsed/)
    expect(src).toMatch(/runChain\('main', q, q, notOtherCover/)
    expect(src).toContain('coverFallbackPlaceQueries(')
  })
})
