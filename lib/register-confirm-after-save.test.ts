import { beforeEach, describe, expect, it, vi } from 'vitest'

const gateMock = vi.fn()
const listingMock = vi.fn()
const detailMock = vi.fn()

vi.mock('@/lib/register-pending-pre-photo-self-heal', () => ({
  applyRegisterPrePhotoQueueGateAfterSave: (...args: unknown[]) => gateMock(...args),
}))

vi.mock('@/lib/revalidate-product-listing-caches', () => ({
  revalidateProductListingCaches: (...args: unknown[]) => listingMock(...args),
}))

vi.mock('@/lib/revalidate-product-detail-caches', () => ({
  revalidateProductDetailCaches: (...args: unknown[]) => detailMock(...args),
}))

import { finalizeRegisterConfirmAfterSave } from '@/lib/register-confirm-after-save'

describe('finalizeRegisterConfirmAfterSave', () => {
  beforeEach(() => {
    gateMock.mockReset()
    listingMock.mockReset()
    detailMock.mockReset()
    gateMock.mockResolvedValue({ verified: 1, verifyFailed: 0, failed: 0, scanned: 1 })
    listingMock.mockImplementation(() => undefined)
    detailMock.mockResolvedValue(undefined)
  })

  it('힐+검증 게이트를 캐시보다 먼저 돌린다', async () => {
    const order: string[] = []
    gateMock.mockImplementation(async () => {
      order.push('gate')
      return { verified: 1, verifyFailed: 0, failed: 0, scanned: 1 }
    })
    listingMock.mockImplementation(() => {
      order.push('listing')
    })
    detailMock.mockImplementation(async () => {
      order.push('detail')
    })
    await finalizeRegisterConfirmAfterSave('prod-1')
    expect(order).toEqual(['gate', 'listing', 'detail'])
  })

  it('캐시 invariant가 터져도 confirm을 깨지 않는다', async () => {
    listingMock.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag air-hotel-listing')
    })
    await expect(finalizeRegisterConfirmAfterSave('prod-1')).resolves.toBeUndefined()
    expect(gateMock).toHaveBeenCalledWith('prod-1')
  })

  it('게이트가 터져도 캐시 전에 삼키고 confirm을 깨지 않는다', async () => {
    gateMock.mockRejectedValue(new Error('heal boom'))
    await expect(finalizeRegisterConfirmAfterSave('prod-1')).resolves.toBeUndefined()
    expect(listingMock).toHaveBeenCalled()
  })
})
