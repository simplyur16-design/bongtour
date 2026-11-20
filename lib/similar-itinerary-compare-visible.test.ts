import { describe, expect, it } from 'vitest'
import { selectVisibleCompareRows } from '@/lib/similar-itinerary-compare-visible'

const rows = [
  { id: 'self', slug: 'pkg-self', supplierKey: 'hanatour', supplierLabel: '하나투어', weekAdultKrw: 400_000 },
  { id: 'vg-dear', slug: 'pkg-vg-1', supplierKey: 'verygoodtour', supplierLabel: '참좋은여행', weekAdultKrw: 900_000 },
  { id: 'vg-cheap', slug: 'pkg-vg-2', supplierKey: 'verygoodtour', supplierLabel: '참좋은여행', weekAdultKrw: 500_000 },
  { id: 'yb', slug: 'pkg-yb-1', supplierKey: 'ybtour', supplierLabel: '노랑풍선', weekAdultKrw: null },
  { id: 'yb-2', slug: 'pkg-yb-2', supplierKey: 'ybtour', supplierLabel: '노랑풍선', weekAdultKrw: 700_000 },
]

describe('selectVisibleCompareRows', () => {
  it('자기 자신을 빼고 공급사당 저장된 요금이 낮은 한 행만 남긴다', () => {
    const visible = selectVisibleCompareRows(rows, { excludeSlug: 'pkg-self' })
    expect(visible.map((r) => r.id)).toEqual(['yb-2', 'vg-cheap'])
    expect(visible.some((r) => r.id === 'self')).toBe(false)
    expect(visible.filter((r) => r.supplierKey === 'verygoodtour')).toHaveLength(1)
  })
})
