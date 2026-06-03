import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bookableMinDateYmdForPayload } from '@/lib/product-public-detail/payload-io'
import { finalizeProductPublicDetailPayloadJson } from '@/lib/product-public-detail/build-product-public-detail-payload'
import type { ProductPublicDetailPackageRenderModel } from '@/lib/product-public-detail/types'
import { loadProductDetailRowSmartPublic } from '@/lib/product-detail-smart-load'

const slimFindFirst = vi.fn()
const fullFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findFirst: (...args: unknown[]) => {
        const select = (args[0] as { select?: Record<string, unknown> })?.select ?? {}
        if ('departures' in select || 'rawMeta' in select) {
          return fullFindFirst(...args)
        }
        return slimFindFirst(...args)
      },
    },
  },
}))

function minimalModel(): ProductPublicDetailPackageRenderModel {
  return {
    variant: 'package',
    viewProduct: {
      id: 'cache-test',
      title: 't',
      destination: 'd',
      duration: '3박4일',
      airline: 'a',
      prices: [],
      schedule: [],
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

describe('loadProductDetailRowSmartPublic', () => {
  beforeEach(() => {
    slimFindFirst.mockReset()
    fullFindFirst.mockReset()
  })

  it('uses slim select only when DTO hit (no full select)', async () => {
    const ymd = bookableMinDateYmdForPayload()
    const json = finalizeProductPublicDetailPayloadJson(minimalModel(), ymd)!
    slimFindFirst.mockResolvedValue({
      id: 'cache-test',
      registrationStatus: 'registered',
      productType: 'package',
      slug: 'pkg-1',
      publicDetailPayloadJson: json,
      publicDetailPayloadBuiltAt: new Date(),
    })

    const { row, selectKind } = await loadProductDetailRowSmartPublic('cache-test')

    expect(selectKind).toBe('slim')
    expect(row).not.toBeNull()
    expect(slimFindFirst).toHaveBeenCalledTimes(1)
    expect(fullFindFirst).not.toHaveBeenCalled()
    expect(row && 'rawMeta' in row).toBe(false)
  })

  it('falls back to full select when payload stale', async () => {
    slimFindFirst.mockResolvedValue({
      id: 'cache-test',
      registrationStatus: 'registered',
      productType: 'package',
      slug: 'pkg-1',
      publicDetailPayloadJson: finalizeProductPublicDetailPayloadJson(minimalModel(), '2000-01-01'),
      publicDetailPayloadBuiltAt: new Date(),
    })
    fullFindFirst.mockResolvedValue({
      id: 'cache-test',
      registrationStatus: 'registered',
      rawMeta: '{}',
      departures: [],
      publicDetailPayloadJson: null,
    })

    const { selectKind } = await loadProductDetailRowSmartPublic('cache-test')

    expect(selectKind).toBe('full')
    expect(slimFindFirst).toHaveBeenCalledTimes(1)
    expect(fullFindFirst).toHaveBeenCalledTimes(1)
  })
})
