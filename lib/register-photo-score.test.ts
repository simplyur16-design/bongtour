import { describe, expect, it } from 'vitest'
import {
  dropDayPhotosDuplicatingMain,
  photoQualityScore,
  rankPhotosByScore,
  recentUsePenalty,
  rotatePoolWithinCity,
  type RecentUseIndex,
} from '@/lib/register-photo-score'
import { buildRecentUseIndex } from '@/lib/register-photo-recent-use'

const a = { url: 'https://images.pexels.com/photos/1/a.jpeg', externalId: '1', tier: 'pexels', width: 4000, height: 2667, pageUrl: 'https://www.pexels.com/photo/da-nang-dragon-bridge-1/' }
const b = { url: 'https://images.pexels.com/photos/2/b.jpeg', externalId: '2', tier: 'pexels', width: 2000, height: 1333, pageUrl: 'https://www.pexels.com/photo/beach-2/' }

describe('register-photo-score', () => {
  it('quality first: higher resolution and keyword match win', () => {
    expect(photoQualityScore(a, ['Da Nang'])).toBeGreaterThan(photoQualityScore(b, ['Da Nang']))
    expect(rankPhotosByScore([b, a], { keywords: ['Da Nang'] })[0]).toBe(a)
  })
  it('under 1200px is effectively rejected', () => {
    expect(photoQualityScore({ ...a, width: 1000 })).toBeLessThan(-100)
  })
  it('recent-use penalty pushes a recently used photo below a fresh one', () => {
    const recent: RecentUseIndex = new Map([['pexels:1', { uses: 3, lastUsedDaysAgo: 2, sameCityUses: 2 }]])
    expect(recentUsePenalty(recent.get('pexels:1'))).toBeGreaterThan(40)
    expect(rankPhotosByScore([a, b], { keywords: ['Da Nang'], recent })[0]).toBe(b)
  })
  it('rotates pool photos within the same city: least recently used first', () => {
    const pool = [
      { filePath: 'https://cdn/x/p1.webp', source: 'Pexels', sourcePhotoId: '11' },
      { filePath: 'https://cdn/x/p2.webp', source: 'Pexels', sourcePhotoId: '12' },
    ]
    const idx = buildRecentUseIndex(
      [{ url: 'https://cdn/x/p1.webp?v=1', productId: 'other', at: new Date(), sameCity: true }],
      new Map([['https://cdn/x/p1.webp', ['pexels:11']]])
    )
    expect(rotatePoolWithinCity(pool, idx)[0]!.filePath).toBe('https://cdn/x/p2.webp')
    expect(idx.get('pexels:11')?.sameCityUses).toBe(1)
  })
  it('main and day photos differ: duplicates of main or earlier days are dropped', () => {
    const out = dropDayPhotosDuplicatingMain('https://cdn/m.webp', [
      { url: 'https://cdn/m.webp?x=1' },
      { url: 'https://cdn/d2.webp' },
      { url: 'https://cdn/d2.webp' },
      null,
    ])
    expect(out).toEqual([null, { url: 'https://cdn/d2.webp' }, null, null])
  })
})
