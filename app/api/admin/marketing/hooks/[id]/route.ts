import { NextResponse } from 'next/server'
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
 * PATCH /api/admin/marketing/hooks/:id
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.bongHookLibrary.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const data: {
    hookType?: string
    hookText?: string
    category?: string | null
    context?: string | null
    isActive?: boolean
    tags?: string[]
  } = {}

  if (typeof body.hookType === 'string' && (HOOK_TYPES as readonly string[]).includes(body.hookType)) {
    data.hookType = body.hookType
  }
  if (typeof body.hookText === 'string') {
    const hookText = body.hookText.trim()
    if (!hookText) return NextResponse.json({ error: 'hookText 비어 있음' }, { status: 400 })
    data.hookText = hookText
  }
  if (body.category === null || typeof body.category === 'string') {
    data.category = body.category === null ? null : body.category.trim() || null
  }
  if (body.context === null || typeof body.context === 'string') {
    data.context = body.context === null ? null : body.context.trim() || null
  }
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (Array.isArray(body.tags)) {
    data.tags = body.tags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim())
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '변경할 필드 없음' }, { status: 400 })
  }

  if (data.hookText && data.hookText !== existing.hookText) {
    const dup = await prisma.bongHookLibrary.findFirst({
      where: { hookText: data.hookText, NOT: { id } },
    })
    if (dup) return NextResponse.json({ error: '동일한 hookText 가 이미 있습니다.' }, { status: 400 })
  }

  const item = await prisma.bongHookLibrary.update({ where: { id }, data })
  return NextResponse.json({ item })
}

/**
 * DELETE /api/admin/marketing/hooks/:id
 */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.bongHookLibrary.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.bongHookLibrary.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
