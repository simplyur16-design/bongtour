import { describe, expect, it } from 'vitest'
import { isSupplierPhotoSource, isSupplierPhotoUrl, orderThumbnailCandidates, thumbnailRotationIndex } from '@/lib/thumbnail-pick'

describe('thumbnail-pick', () => {
  it('공급사 주소는 거르고, 스톡·저장소 주소는 남긴다', () => {
    expect(isSupplierPhotoUrl('https://img.hanatour.com/package/a.jpg')).toBe(true)
    expect(isSupplierPhotoUrl('https://www.modetour.com/photo/1.jpg')).toBe(true)
    expect(isSupplierPhotoUrl('https://cdn.verygoodtour.com/a.jpg')).toBe(true)
    expect(isSupplierPhotoUrl('https://images.pexels.com/photos/1/a.jpeg')).toBe(false)
    expect(isSupplierPhotoUrl('https://images.unsplash.com/photo-1')).toBe(false)
    expect(isSupplierPhotoUrl('https://kr.object.ncloudstorage.com/bongtour/a.webp')).toBe(false)
    expect(isSupplierPhotoSource('hanatour')).toBe(true)
    expect(isSupplierPhotoSource('pexels')).toBe(false)
    expect(isSupplierPhotoSource('istock')).toBe(false)
  })

  it('상품 id가 같으면 같은 칸이고, 여러 id는 한 칸에 모이지 않는다', () => {
    expect(thumbnailRotationIndex('pkg-a', 5)).toBe(thumbnailRotationIndex('pkg-a', 5))
    expect(thumbnailRotationIndex('pkg-a', 1)).toBe(0)
    const indexes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => thumbnailRotationIndex(id, 5))
    expect(new Set(indexes).size).toBeGreaterThan(1)
  })

  it('가장 적게 쓴 사진만 먼저 돌리고, 같은 상품은 항상 같은 사진을 고른다', () => {
    const items = [{ id: 'used' }, { id: 'fresh-a' }, { id: 'fresh-b' }]
    const uses: Record<string, number> = { used: 4, 'fresh-a': 0, 'fresh-b': 0 }
    const once = orderThumbnailCandidates(items, 'prod-1', (item) => uses[item.id] ?? 0)
    const twice = orderThumbnailCandidates(items, 'prod-1', (item) => uses[item.id] ?? 0)
    expect(once.map((x) => x.id)).toEqual(twice.map((x) => x.id))
    expect(once[0]!.id).not.toBe('used')
    expect(once[2]!.id).toBe('used')
    const other = orderThumbnailCandidates(items, 'prod-2', (item) => uses[item.id] ?? 0)
    expect(['fresh-a', 'fresh-b']).toContain(other[0]!.id)
  })
})
