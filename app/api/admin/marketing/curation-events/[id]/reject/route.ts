import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type RouteContext = { params: Promise<{ id: string }> }

/** POST /api/admin/marketing/curation-events/[id]/reject */
export async function POST(_req: Request, context: RouteContext) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.curationEvent.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 })
  }

  const event = await prisma.curationEvent.update({
    where: { id },
    data: { status: 'rejected' },
  })

  return NextResponse.json({ event })
}
