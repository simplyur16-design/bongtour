import { describe, expect, it } from 'vitest'
import { thumbnailPoolFetchCount, topUpThumbnailPlacePool } from '@/lib/thumbnail-pool-topup'

describe('thumbnail-pool-topup', () => {
  it('10장 미만만 20장까지 채운다', () => {
    expect(thumbnailPoolFetchCount(0)).toBe(20)
    expect(thumbnailPoolFetchCount(9)).toBe(11)
    expect(thumbnailPoolFetchCount(10)).toBe(0)
    expect(thumbnailPoolFetchCount(20)).toBe(0)
  })

  it('검색이 실패하면 한 번 더 하고, 또 실패하면 그 출처는 건너뛴다', async () => {
    let pexels = 0
    const saved: string[] = []
    const r = await topUpThumbnailPlacePool({
      have: 8,
      pause: async () => {},
      search: async (tier) => {
        if (tier === 'pexels') {
          pexels += 1
          if (pexels === 1) throw new Error('timeout')
          return [
            { id: '1', source: 'Pexels', url: 'https://images.pexels.com/photos/1/a.jpeg' },
            { id: 's', source: 'Pexels', url: 'https://img.hanatour.com/a.jpg' },
          ]
        }
        throw new Error('down')
      },
      searchCc0: async () => {
        throw new Error('down')
      },
      save: async (c) => {
        saved.push(c.id)
        return true
      },
    })
    expect(pexels).toBe(2)
    expect(saved).toEqual(['1'])
    expect(r.added).toBe(1)
    expect(r.skipped).toContain('pixabay')
    expect(r.skipped).toContain('cc0')
  })
})
