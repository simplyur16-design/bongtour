import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finalizeProductPublicDetailPayloadJson } from '@/lib/product-public-detail/build-product-public-detail-payload'
import { bookableMinDateYmdForPayload } from '@/lib/product-public-detail/payload-io'
import type { ProductPublicDetailPackageRenderModel } from '@/lib/product-public-detail/types'

const findFirstMock = vi.fn()
const updateMock = vi.fn(() => Promise.resolve({}))
const buildMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}))

vi.mock('@/lib/product-public-detail/build-render-model', () => ({
  buildProductPublicDetailRenderModel: (...args: unknown[]) => buildMock(...args),
}))

vi.mock('@/lib/next-router-prefetch', () => ({
  isNextRouterPrefetchRequest: () => Promise.resolve(false),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: (fn: () => void | Promise<void>) => {
    void fn()
  },
}))

function minimalModel(title = 'full-title'): ProductPublicDetailPackageRenderModel {
  return {
    variant: 'package',
    viewProduct: {
      id: 'p-slim',
      title,
      destination: 'd',
      duration: '3박4일',
      airline: 'a',
      prices: [],
      schedule: [{ day: 1, description: 'day1' }],
    } as ProductPublicDetailPackageRenderModel['viewProduct'],
    ybtourDetailProduct: null,
    publicConsumptionModuleKey: 'modetour',
    isPackageItineraryBody: true,
    isPrivateOrSemi: false,
    showEsimCrossSell: false,
    resolvedPriceFrom: 1,
    seo: {
      coverUrl: null,
      productDescription: 'd',
      offers: null,
      breadcrumbItems: [],
      itinerary: null,
    },
    registrationStatus: 'registered',
    departuresForSeo: [],
  }
}

describe('getOrBuildProductPublicDetailModel slim-row guard', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    updateMock.mockClear()
    buildMock.mockReset()
    buildMock.mockResolvedValue(minimalModel())
  })

  it('payload hit on slim row — full reload·persist 없음', async () => {
    const ymd = bookableMinDateYmdForPayload()
    const json = finalizeProductPublicDetailPayloadJson(minimalModel('cached'), ymd)!
    const slim = {
      id: 'p-slim',
      registrationStatus: 'registered',
      productType: 'travel',
      slug: 'pkg-1',
      publicDetailPayloadJson: json,
      publicDetailPayloadBuiltAt: new Date(),
    }

    const { getOrBuildProductPublicDetailModel } = await import('@/lib/product-public-detail/get-or-build-model')
    const result = await getOrBuildProductPublicDetailModel(slim, null)

    expect(result.source).toBe('payload')
    expect(findFirstMock).not.toHaveBeenCalled()
    expect(buildMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('payload miss on slim row — full row로 build·persist', async () => {
    const slim = {
      id: 'p-slim',
      registrationStatus: 'registered',
      productType: 'travel',
      slug: 'pkg-1',
      publicDetailPayloadJson: finalizeProductPublicDetailPayloadJson(minimalModel(), '2000-01-01'),
      publicDetailPayloadBuiltAt: new Date(),
    }
    const fullRow = {
      id: 'p-slim',
      registrationStatus: 'registered',
      productType: 'travel',
      title: 'DB title',
      schedule: '[]',
      rawMeta: '{}',
      departures: [],
      prices: [],
      itineraries: [],
      itineraryDays: [],
      optionalTours: [],
      brand: null,
    }
    findFirstMock.mockResolvedValue(fullRow)

    const { getOrBuildProductPublicDetailModel } = await import('@/lib/product-public-detail/get-or-build-model')
    const result = await getOrBuildProductPublicDetailModel(slim, null)

    expect(result.source).toBe('computed')
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    expect(buildMock).toHaveBeenCalledWith(fullRow, null)
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('payload miss on slim row + full load 실패 — persist 금지', async () => {
    const slim = {
      id: 'p-slim',
      registrationStatus: 'registered',
      productType: 'travel',
      slug: 'pkg-1',
      publicDetailPayloadJson: null,
      publicDetailPayloadBuiltAt: null,
    }
    findFirstMock.mockResolvedValue(null)

    const { getOrBuildProductPublicDetailModel } = await import('@/lib/product-public-detail/get-or-build-model')
    await getOrBuildProductPublicDetailModel(slim, null)

    expect(buildMock).toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
