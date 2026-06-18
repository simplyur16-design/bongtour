import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** POST /api/admin/marketing/curation-events/bulk-approve */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  if (!ids.length) {
    return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 })
  }

  const result = await prisma.curationEvent.updateMany({
    where: { id: { in: ids }, status: 'draft' },
    data: { status: 'approved' },
  })

  return NextResponse.json({ approved: result.count, ids })
}
