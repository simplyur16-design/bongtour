import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/admin/marketing/curation-events/list/route'
import { POST as approvePost } from '@/app/api/admin/marketing/curation-events/[id]/approve/route'
import { POST as rejectPost } from '@/app/api/admin/marketing/curation-events/[id]/reject/route'
import { POST as bulkApprovePost } from '@/app/api/admin/marketing/curation-events/bulk-approve/route'
import { PATCH } from '@/app/api/admin/marketing/curation-events/[id]/route'

vi.mock('@/lib/require-admin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    curationEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'

const adminSession = { user: { id: 'admin-1' } }

describe('GET /api/admin/marketing/curation-events/list', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(prisma.curationEvent.findMany).mockReset()
    vi.mocked(prisma.curationEvent.count).mockReset()
  })

  it('returns 403 without admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null as never)
    const res = await GET(new Request('http://localhost/api/admin/marketing/curation-events/list'))
    expect(res.status).toBe(403)
  })

  it('lists events with filters', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'e1',
        name: '마쯔리',
        countryCode: '일본',
        status: 'draft',
        monthlyCurationContentId: null,
        monthlyCurationContent: null,
      },
    ] as never)
    vi.mocked(prisma.curationEvent.count).mockResolvedValue(1)

    const res = await GET(
      new Request(
        'http://localhost/api/admin/marketing/curation-events/list?status=draft&country=일본&limit=10',
      ),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(1)
    expect(json.events).toHaveLength(1)
    expect(json.events[0].linkedSeasonCard).toBeNull()
    expect(prisma.curationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'draft', countryCode: '일본' }),
        orderBy: { collectedAt: 'desc' },
        take: 10,
        include: {
          monthlyCurationContent: {
            select: { id: true, title: true, monthKey: true },
          },
        },
      }),
    )
  })

  it('filters linked season cards and returns linkedSeasonCard payload', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.findMany).mockResolvedValue([
      {
        id: 'e2',
        name: '다낭 불꽃축제',
        countryCode: '베트남',
        status: 'approved',
        monthlyCurationContentId: 'card-1',
        monthlyCurationContent: {
          id: 'card-1',
          title: '7월의 다낭',
          monthKey: '2026-07',
        },
      },
    ] as never)
    vi.mocked(prisma.curationEvent.count).mockResolvedValue(1)

    const res = await GET(
      new Request('http://localhost/api/admin/marketing/curation-events/list?linked=linked'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.events[0].linkedSeasonCard).toEqual({
      id: 'card-1',
      title: '7월의 다낭',
      monthKey: '2026-07',
    })
    expect(prisma.curationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ monthlyCurationContentId: { not: null } }),
      }),
    )
  })
})

describe('POST approve/reject/bulk-approve', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(prisma.curationEvent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
    vi.mocked(prisma.curationEvent.updateMany).mockReset()
  })

  it('approves draft event', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'e1',
      status: 'draft',
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({
      id: 'e1',
      status: 'approved',
    } as never)

    const res = await approvePost(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'e1' }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.event.status).toBe('approved')
  })

  it('rejects draft event', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'e1',
      status: 'draft',
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({
      id: 'e1',
      status: 'rejected',
    } as never)

    const res = await rejectPost(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'e1' }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.event.status).toBe('rejected')
  })

  it('bulk approves draft ids', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.updateMany).mockResolvedValue({ count: 2 })

    const res = await bulkApprovePost(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['a', 'b'] }),
      }),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.approved).toBe(2)
    expect(prisma.curationEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, status: 'draft' },
      data: { status: 'approved' },
    })
  })
})

describe('PATCH /api/admin/marketing/curation-events/[id]', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(prisma.curationEvent.findUnique).mockReset()
    vi.mocked(prisma.curationEvent.update).mockReset()
  })

  it('updates editable fields', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(prisma.curationEvent.findUnique).mockResolvedValue({
      id: 'e1',
      year: 2026,
    } as never)
    vi.mocked(prisma.curationEvent.update).mockResolvedValue({
      id: 'e1',
      name: '수정된 이름',
    } as never)

    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '수정된 이름', startMonth: 8 }),
      }),
      { params: Promise.resolve({ id: 'e1' }) },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.event.name).toBe('수정된 이름')
    expect(prisma.curationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '수정된 이름',
          startMonth: 8,
          monthKey: '2026-08',
        }),
      }),
    )
  })
})
