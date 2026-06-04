import { describe, expect, it } from 'vitest'
import { resolveModetourProductForSync } from '@/lib/sync-modetour-price-single'

describe('resolveModetourProductForSync validation', () => {
  it('rejects non-modetour origin', async () => {
    const prisma = {
      product: {
        findFirst: async () => ({
          id: 'p1',
          slug: 'pkg-h-0001',
          title: 't',
          originSource: 'hanatour',
          originCode: 'x',
          originUrl: 'https://example.com',
          listingKind: 'travel',
          productType: 'travel',
          publicDetailPayloadBuiltAt: null,
        }),
      },
    } as unknown as import('@prisma/client').PrismaClient

    await expect(resolveModetourProductForSync(prisma, { slug: 'pkg-h-0001' })).rejects.toThrow(
      /modetour/,
    )
  })

  it('rejects air_hotel_free listing', async () => {
    const prisma = {
      product: {
        findFirst: async () => ({
          id: 'p2',
          slug: 'pkg-mt-air',
          title: 't',
          originSource: 'modetour',
          originCode: 'x',
          originUrl: 'https://www.modetour.com/package/detail?pkgCd=1',
          listingKind: 'air_hotel_free',
          productType: 'airtel',
          publicDetailPayloadBuiltAt: null,
        }),
      },
    } as unknown as import('@prisma/client').PrismaClient

    await expect(resolveModetourProductForSync(prisma, { slug: 'pkg-mt-air' })).rejects.toThrow(
      /자유여행|airtel/,
    )
  })
})
