import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const HOOK_TYPES = ['good', 'bad'] as const

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * GET /api/admin/marketing/hooks
 */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const hookType = searchParams.get('hookType')?.trim()
  const category = searchParams.get('category')?.trim()
  const source = searchParams.get('source')?.trim()
  const search = searchParams.get('search')?.trim()
  const isActiveRaw = searchParams.get('isActive')

  const where: Prisma.BongHookLibraryWhereInput = {}
  if (hookType === 'good' || hookType === 'bad') where.hookType = hookType
  if (category) where.category = category
  if (source) where.source = source
  if (search) where.hookText = { contains: search, mode: 'insensitive' }
  if (isActiveRaw === 'true') where.isActive = true
  if (isActiveRaw === 'false') where.isActive = false

  const items = await prisma.bongHookLibrary.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ items })
}

/**
 * POST /api/admin/marketing/hooks — 수동 등록
 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const hookText = typeof body.hookText === 'string' ? body.hookText.trim() : ''
  if (!hookText) return NextResponse.json({ error: 'hookText 필수' }, { status: 400 })

  const hookType =
    typeof body.hookType === 'string' && (HOOK_TYPES as readonly string[]).includes(body.hookType)
      ? body.hookType
      : 'good'

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
    : []

  const dup = await prisma.bongHookLibrary.findFirst({ where: { hookText } })
  if (dup) {
    return NextResponse.json({ error: '동일한 hookText 가 이미 있습니다.' }, { status: 400 })
  }

  const item = await prisma.bongHookLibrary.create({
    data: {
      hookType,
      hookText,
      context: typeof body.context === 'string' ? body.context.trim() || null : null,
      category: typeof body.category === 'string' ? body.category.trim() || null : null,
      source: typeof body.source === 'string' ? body.source.trim() || 'manual' : 'manual',
      tags,
      isActive: body.isActive !== false,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
