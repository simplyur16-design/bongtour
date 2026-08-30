import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  safeRevalidatePath,
  safeRevalidateProductDetailTags,
  safeRevalidateTag,
} from '@/lib/safe-next-cache-revalidate'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const revalidateTagMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

describe('safe-next-cache-revalidate', () => {
  beforeEach(() => {
    revalidateTagMock.mockReset()
    revalidatePathMock.mockReset()
    revalidateTagMock.mockImplementation(() => undefined)
    revalidatePathMock.mockImplementation(() => undefined)
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

  it('skips revalidatePath when static generation store is missing', () => {
    revalidatePathMock.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidatePath /travel/overseas')
    })
    expect(safeRevalidatePath('/travel/overseas')).toBe(false)
  })

  it('listing cache revalidate does not throw outside Next request', () => {
    revalidateTagMock.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag air-hotel-listing')
    })
    revalidatePathMock.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidatePath /')
    })
    expect(() => revalidateProductListingCaches()).not.toThrow()
  })
})
