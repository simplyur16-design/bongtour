import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { isAdminOnlyRole } from '@/lib/admin-roles'
import { displayRole } from '@/lib/user-role'

/**
 * GET /api/admin/staff?q= — 일반 사용자 검색 (ADMIN 전용)
 */
export async function GET(req: Request) {
  const session = await requireAdmin()
  const actorRole = (session?.user as { role?: string | null } | undefined)?.role
  if (!session?.user?.id || !isAdminOnlyRole(actorRole)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  const and: Record<string, unknown>[] = [
    { OR: [{ role: null }, { role: 'USER' }, { role: 'STAFF' }] },
  ]
  if (q) {
    and.push({
      OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }],
    })
  }

  const users = await prisma.user.findMany({
    where: { AND: and },
    orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      roleLabel: displayRole(u.role),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  })
}

type PatchBody = { userId?: string; role?: 'STAFF' | null }

/**
 * PATCH /api/admin/staff — STAFF 승격 / 강등 (ADMIN 전용)
 */
export async function PATCH(req: Request) {
  const session = await requireAdmin()
  const actorRole = (session?.user as { role?: string | null } | undefined)?.role
  const actorId = session?.user?.id
  if (!actorId || !isAdminOnlyRole(actorRole)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })
  }
  if (userId === actorId) {
    return NextResponse.json({ error: '본인 권한은 이 화면에서 변경할 수 없습니다.' }, { status: 400 })
  }

  if (body.role !== 'STAFF' && body.role !== null) {
    return NextResponse.json({ error: 'role은 STAFF 또는 null만 허용됩니다.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  })
  if (!target) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: '관리자 계정의 역할은 변경할 수 없습니다.' }, { status: 403 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: body.role },
    select: { id: true, name: true, email: true, role: true, accountStatus: true },
  })

  return NextResponse.json({ ok: true, user: updated })
}
