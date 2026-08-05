import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import type { CurationEventStatus } from '@/lib/bong-marketing/curation-event-repository'

const VALID_STATUSES = new Set<CurationEventStatus>(['draft', 'approved', 'rejected'])

/** GET /api/admin/marketing/curation-events/list */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusRaw = searchParams.get('status')?.trim()
  const country = searchParams.get('country')?.trim()
  const monthKey = searchParams.get('monthKey')?.trim()
  const search = searchParams.get('search')?.trim()
  const linkedRaw = searchParams.get('linked')?.trim()
  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')

  const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200)
  const offset = Math.max(Number(offsetRaw) || 0, 0)

  const where: Prisma.CurationEventWhereInput = {}
  if (statusRaw && VALID_STATUSES.has(statusRaw as CurationEventStatus)) {
    where.status = statusRaw
  }
  if (country) where.countryCode = country
  if (monthKey) where.monthKey = monthKey
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (linkedRaw === 'linked') {
    where.monthlyCurationContentId = { not: null }
  } else if (linkedRaw === 'unlinked') {
    where.monthlyCurationContentId = null
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.curationEvent.findMany({
        where,
        orderBy: { collectedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          monthlyCurationContent: {
            select: { id: true, title: true, monthKey: true },
          },
        },
      }),
      prisma.curationEvent.count({ where }),
    ])

    const events = rows.map((row) => {
      const { monthlyCurationContent, ...rest } = row
      return {
        ...rest,
        linkedSeasonCard: monthlyCurationContent,
      }
    })

    return NextResponse.json({ events, total, limit, offset })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/admin/marketing/curation-events/list]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
