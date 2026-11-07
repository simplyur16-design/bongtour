import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  prismaRead: {},
}))

import { MODETOUR_SWEEP_REGISTRATION_STATUSES, sweepDueModetourProducts } from '@/lib/modetour-sweep'
import {
  VERYGOODTOUR_SWEEP_REGISTRATION_STATUSES,
  sweepDueVerygoodtourProducts,
} from '@/lib/verygoodtour-sweep'
import { YBTOUR_SWEEP_REGISTRATION_STATUSES, sweepDueYbtourProducts } from '@/lib/ybtour-sweep'

/**
 * Product.registrationStatus 값 (prisma/schema.prisma 주석 + pre_photo_blocked).
 * 포함: registered, pending, pre_photo_blocked
 * 제외: on_hold, rejected, auto_unpublished, null, ''
 * deleted / inactive / hidden 은 이 컬럼의 상태가 아니다.
 */
const EXCLUDED_STATUSES = ['on_hold', 'rejected', 'auto_unpublished', 'deleted', 'inactive', 'hidden', '', null] as const

const LISTS = [
  ['modetour', MODETOUR_SWEEP_REGISTRATION_STATUSES],
  ['verygoodtour', VERYGOODTOUR_SWEEP_REGISTRATION_STATUSES],
  ['ybtour', YBTOUR_SWEEP_REGISTRATION_STATUSES],
] as const

describe('daily sweep registration status', () => {
  it('includes only registered, pending, and pre_photo_blocked', () => {
    for (const [supplier, list] of LISTS) {
      expect(list, supplier).toEqual(['registered', 'pending', 'pre_photo_blocked'])
      for (const excluded of EXCLUDED_STATUSES) {
        expect(list as readonly (string | null)[], supplier).not.toContain(excluded)
      }
    }
  })
})

function prismaReturningNone(): { prisma: PrismaClient; findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> } {
  const findMany = vi.fn().mockResolvedValue([])
  const findFirst = vi.fn().mockResolvedValue(null)
  const prisma = {
    product: { findMany, findFirst, update: vi.fn() },
    productDeparture: { deleteMany: vi.fn() },
  } as unknown as PrismaClient
  return { prisma, findMany, findFirst }
}

describe('sweep queries keep the status list and the batch cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('modetour daily query includes pending and pre_photo_blocked and still takes limit*3', async () => {
    const { prisma, findMany, findFirst } = prismaReturningNone()
    await sweepDueModetourProducts(prisma, { limit: 200, prismaRead: prisma })
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          originSource: 'modetour',
          registrationStatus: { in: [...MODETOUR_SWEEP_REGISTRATION_STATUSES] },
        }),
        take: 600,
      }),
    )
    await sweepDueModetourProducts(prisma, { productId: 'pkg-mt-0275', prismaRead: prisma })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pkg-mt-0275',
          registrationStatus: { in: ['registered', 'pending', 'pre_photo_blocked'] },
        }),
      }),
    )
  })

  it('verygoodtour daily query includes the same three statuses', async () => {
    const { prisma, findMany, findFirst } = prismaReturningNone()
    await sweepDueVerygoodtourProducts(prisma, { limit: 200, prismaRead: prisma })
    expect(findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          originSource: 'verygoodtour',
          registrationStatus: { in: [...VERYGOODTOUR_SWEEP_REGISTRATION_STATUSES] },
        }),
        take: 600,
      }),
    )
    await sweepDueVerygoodtourProducts(prisma, { productId: 'pkg-vg-0045', prismaRead: prisma })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pkg-vg-0045',
          registrationStatus: { in: ['registered', 'pending', 'pre_photo_blocked'] },
        }),
      }),
    )
  })

  it('ybtour daily query includes the same three statuses', async () => {
    const { prisma, findMany, findFirst } = prismaReturningNone()
    await sweepDueYbtourProducts(prisma, { limit: 200, prismaRead: prisma })
    expect(findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          originSource: 'ybtour',
          registrationStatus: { in: [...YBTOUR_SWEEP_REGISTRATION_STATUSES] },
        }),
        take: 600,
      }),
    )
    await sweepDueYbtourProducts(prisma, { productId: 'pkg-yb-unused', prismaRead: prisma })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationStatus: { in: ['registered', 'pending', 'pre_photo_blocked'] },
        }),
      }),
    )
  })
})
