import { beforeEach, describe, expect, it, vi } from 'vitest'
import { safeRevalidateProductDetailTags, safeRevalidateTag } from '@/lib/safe-next-cache-revalidate'

const revalidateTagMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

describe('safe-next-cache-revalidate', () => {
  beforeEach(() => {
    revalidateTagMock.mockReset()
    revalidateTagMock.mockImplementation(() => undefined)
  })

  it('calls revalidateTag in Next request context', () => {
    expect(safeRevalidateTag('product-detail')).toBe(true)
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail')
  })

  it('skips when static generation store is missing (instrumentation cron)', () => {
    revalidateTagMock.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag product-detail')
    })
    expect(safeRevalidateTag('product-detail')).toBe(false)
  })

  it('rethrows unexpected revalidateTag errors', () => {
    revalidateTagMock.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => safeRevalidateTag('product-detail')).toThrow('boom')
  })

  it('revalidates product id tag and list tag', () => {
    safeRevalidateProductDetailTags('p1')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail-p1')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail')
  })
})
