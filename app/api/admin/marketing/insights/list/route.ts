import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const SORT_FIELDS = ['reach', 'likes', 'saved', 'publishedAt'] as const

/** GET /api/admin/marketing/insights/list */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '20', 10) || 20))
  const sortByRaw = url.searchParams.get('sortBy') || 'reach'
  const sortBy = (SORT_FIELDS as readonly string[]).includes(sortByRaw) ? sortByRaw : 'reach'
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

  const orderBy = { [sortBy]: sortDir } as Prisma.BongPostInsightOrderByWithRelationInput

  const insights = await prisma.bongPostInsight.findMany({
    take: limit,
    orderBy,
    where: { reach: { not: null } },
  })

  return NextResponse.json({ insights })
}
