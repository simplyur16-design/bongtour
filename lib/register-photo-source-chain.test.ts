import { describe, expect, it, vi } from 'vitest'
import {
  findStockPhotoByChain,
  isPhotoChainV2Enabled,
  unsplashSizedHotlink,
  PHOTO_CHAIN_STOCK_ORDER,
} from '@/lib/register-photo-source-chain'

const px = (id: number, width = 4000) => ({
  pexelsId: id,
  imageUrl: `https://images.pexels.com/photos/${id}/a.jpeg`,
  photographer: 'P',
  width,
  height: Math.round(width / 1.5),
  originalLink: `https://www.pexels.com/photo/da-nang-${id}/`,
  queryUsed: 'Da Nang',
})
const us = (id: string, over: Record<string, unknown> = {}) => ({
  unsplashId: id,
  imageUrl: `https://images.unsplash.com/photo-${id}?w=2400&fm=jpg&q=80&fit=max`,
  width: 2400,
  height: 1600,
  downloadLocation: `https://api.unsplash.com/photos/${id}/download`,
  queryUsed: 'Da Nang',
  authorName: 'U',
  authorProfileUrl: 'https://unsplash.com/@u',
  ...over,
})

describe('register-photo-source-chain', () => {
  it('order is Pexels → Unsplash → CC0', () => {
    expect([...PHOTO_CHAIN_STOCK_ORDER]).toEqual(['pexels', 'unsplash', 'cc0'])
  })
  it('uses Pexels first and never calls Unsplash when Pexels passes', async () => {
    const searchUnsplash = vi.fn(async () => [us('x')])
    const r = await findStockPhotoByChain('Da Nang', {
      accept: () => true,
      deps: { searchPexels: async () => [px(1)], searchUnsplash },
    })
    expect(r.photo?.source).toBe('Pexels')
    expect(searchUnsplash).not.toHaveBeenCalled()
  })
  it('falls to Unsplash when Pexels has only low-res or used photos, and triggers download', async () => {
    const triggerDownload = vi.fn(async () => true)
    const r = await findStockPhotoByChain('Da Nang', {
      accept: (c) => c.externalId !== '2',
      deps: { searchPexels: async () => [px(1, 800), px(2)], searchUnsplash: async () => [us('abc')], triggerDownload },
    })
    expect(r.photo?.source).toBe('Unsplash')
    expect(r.photo?.originalLink).toBe('https://unsplash.com/@u')
    expect(r.photo?.width).toBeGreaterThanOrEqual(1200)
    expect(triggerDownload).toHaveBeenCalledWith('https://api.unsplash.com/photos/abc/download')
  })
  it('skips Unsplash photos without credit and reports CC0 as no provider; returns null for AI fallback', async () => {
    const r = await findStockPhotoByChain('Da Nang', {
      accept: () => true,
      deps: { searchPexels: async () => [], searchUnsplash: async () => [us('n', { authorName: null })] },
    })
    expect(r.photo).toBeNull()
    expect(r.tried).toContain('cc0:no-provider')
  })
  it('v2 is off by default', () => {
    expect(isPhotoChainV2Enabled({}, {})).toBe(false)
    expect(isPhotoChainV2Enabled({ photoChain: 'v2' }, {})).toBe(true)
    expect(isPhotoChainV2Enabled({}, { BONGTOUR_PHOTO_SOURCE_CHAIN: '1' })).toBe(true)
  })
  it('sizes Unsplash hotlinks to 1600 wide', () => {
    expect(unsplashSizedHotlink('https://images.unsplash.com/photo-1?w=2400&q=80')).toContain('w=1600')
  })
})
