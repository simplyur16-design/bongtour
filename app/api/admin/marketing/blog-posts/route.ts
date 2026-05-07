import { NextResponse } from 'next/server'
import type { BongContentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const POST_STATUSES: BongContentStatus[] = [
  'draft',
  'approved',
  'scheduled',
  'published',
  'rejected',
]

function parseStatus(raw: string | null): BongContentStatus | undefined {
  if (!raw) return undefined
  return POST_STATUSES.includes(raw as BongContentStatus) ? (raw as BongContentStatus) : undefined
}

function parsePagination(searchParams: URLSearchParams): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10) || 20
  const limit = Math.min(100, Math.max(1, limitRaw))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * GET /api/admin/marketing/blog-posts?contentTrack=package|airtel&status=&monthKey=&citySlug=&page=&limit=
 */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const track = searchParams.get('contentTrack')?.trim()
  if (track !== 'package' && track !== 'airtel') {
    return NextResponse.json({ error: 'contentTrack 은 package 또는 airtel 이어야 합니다.' }, { status: 400 })
  }

  const status = parseStatus(searchParams.get('status'))
  const monthKey = searchParams.get('monthKey')?.trim() || undefined
  const citySlug = searchParams.get('citySlug')?.trim() || undefined
  const { page, limit, skip } = parsePagination(searchParams)

  const where: Prisma.BongBlogPostWhereInput = {
    contentTrack: track,
    ...(status ? { status } : {}),
    ...(monthKey ? { monthKey } : {}),
    ...(citySlug ? { citySlug: { contains: citySlug, mode: 'insensitive' } } : {}),
  }

  const [total, items] = await Promise.all([
    prisma.bongBlogPost.count({ where }),
    prisma.bongBlogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        monthKey: true,
        citySlug: true,
        countrySlug: true,
        linkedProductId: true,
        createdAt: true,
        updatedAt: true,
        contentTrack: true,
      },
    }),
  ])

  return NextResponse.json({
    items,
    total,
    page,
    limit,
  })
}
