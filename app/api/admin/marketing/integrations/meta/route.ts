import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

/** GET /api/admin/marketing/integrations/meta — 연결 상태 (토큰 제외) */
export async function GET() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const conn = await prisma.bongMetaConnection.findUnique({
    where: { provider: 'meta' },
    select: {
      provider: true,
      pageId: true,
      pageName: true,
      instagramBusinessId: true,
      userTokenExpiresAt: true,
      connectedAt: true,
      lastRefreshedAt: true,
    },
  })

  if (!conn) return NextResponse.json({ connection: null })

  const now = new Date()
  const isExpired = conn.userTokenExpiresAt < now
  const daysUntilExpiry = Math.floor(
    (conn.userTokenExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  )

  return NextResponse.json({
    connection: {
      ...conn,
      isExpired,
      daysUntilExpiry,
    },
  })
}

/** DELETE /api/admin/marketing/integrations/meta — 연결 해제 */
export async function DELETE() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  await prisma.bongMetaConnection.deleteMany({ where: { provider: 'meta' } })
  return NextResponse.json({ success: true })
}
