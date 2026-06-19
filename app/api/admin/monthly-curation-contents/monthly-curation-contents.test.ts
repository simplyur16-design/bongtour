import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/admin/monthly-curation-contents/route'

vi.mock('@/lib/require-admin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyCurationContent: {
      findMany: vi.fn(),
    },
  },
}))

import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'

describe('GET /api/admin/monthly-curation-contents', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
  })

  it('returns 401 without admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null as never)
    const res = await GET(new Request('http://localhost/api/admin/monthly-curation-contents'))
    expect(res.status).toBe(401)
  })

  it('includes curationEvents relation in list response', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({} as never)
    vi.mocked(prisma.monthlyCurationContent.findMany).mockResolvedValue([
      {
        id: 'card-1',
        monthKey: '2026-07',
        title: '7월의 다낭',
        curationEvents: [
          {
            id: 'ev-1',
            name: '다낭 불꽃축제',
            countryCode: '베트남',
            startMonth: 6,
            endMonth: 7,
            type: 'festival',
            city: '다낭',
          },
        ],
      },
    ] as never)

    const res = await GET(
      new Request(
        'http://localhost/api/admin/monthly-curation-contents?scope=overseas&monthKey=2026-07',
      ),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.items).toHaveLength(1)
    expect(json.items[0].curationEvents).toHaveLength(1)
    expect(json.items[0].curationEvents[0].name).toBe('다낭 불꽃축제')
    expect(prisma.monthlyCurationContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageScope: 'overseas', monthKey: '2026-07' },
        include: {
          curationEvents: {
            select: {
              id: true,
              name: true,
              countryCode: true,
              startMonth: true,
              endMonth: true,
              type: true,
              city: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
    )
  })
})
