import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'

const rebuildMock = vi.fn()
const revalidateTagMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('@/lib/product-public-detail/persist-payload', () => ({
  rebuildProductPublicDetailPayload: (...args: unknown[]) => rebuildMock(...args),
}))

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

describe('revalidateProductDetailCaches (registration SSOT)', () => {
  beforeEach(() => {
    rebuildMock.mockReset()
    revalidateTagMock.mockReset()
    revalidatePathMock.mockReset()
    rebuildMock.mockResolvedValue(true)
  })

  it('calls rebuildProductPublicDetailPayload on new registration path', async () => {
    await revalidateProductDetailCaches('prod-new-1', 'pkg-mt-0099')
    expect(rebuildMock).toHaveBeenCalledTimes(1)
    expect(rebuildMock).toHaveBeenCalledWith('prod-new-1')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail-prod-new-1')
    expect(revalidateTagMock).toHaveBeenCalledWith('product-detail')
    expect(revalidatePathMock).toHaveBeenCalledWith('/products/prod-new-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/products/pkg-mt-0099')
  })
})
