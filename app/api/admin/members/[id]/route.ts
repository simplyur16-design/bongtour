import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMembersEditor } from '@/lib/require-admin'
import { isAccountStatus } from '@/lib/account-status'
import { canAssignRole, normalizeRoleInput, type PatchMemberBody } from '@/lib/member-admin-policy'
import { isSuperAdminRole } from '@/lib/user-role'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireMembersEditor()
  if (!gate.ok) {
    if (gate.reason === 'unauthenticated') {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const actorId = gate.session.user?.id
  const actorRole = (gate.session.user as { role?: string | null })?.role
  if (!actorId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id: targetId } = await ctx.params
  if (targetId === actorId) {
    return NextResponse.json({ error: '본인 계정은 이 화면에서 변경할 수 없습니다.' }, { status: 400 })
  }

  let body: PatchMemberBody
  try {
    body = (await req.json()) as PatchMemberBody
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, email: true },
  })
  if (!target) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (target.role === 'SUPER_ADMIN' && !isSuperAdminRole(actorRole)) {
    return NextResponse.json({ error: '최고관리자 계정은 최고관리자만 수정할 수 있습니다.' }, { status: 403 })
  }

  if (target.role === 'ADMIN' && !isSuperAdminRole(actorRole)) {
    if (body.role !== undefined || body.accountStatus !== undefined) {
      return NextResponse.json({ error: '관리자 계정은 최고관리자만 수정할 수 있습니다.' }, { status: 403 })
    }
  }

  const data: { role?: string | null; accountStatus?: string } = {}

  if (body.accountStatus !== undefined) {
    if (typeof body.accountStatus !== 'string' || !isAccountStatus(body.accountStatus)) {
      return NextResponse.json({ error: '유효하지 않은 계정 상태입니다.' }, { status: 400 })
    }
    data.accountStatus = body.accountStatus
  }

  if (body.role !== undefined) {
    const next = normalizeRoleInput(body.role === '' ? null : body.role)
    if (next === undefined && body.role !== null && body.role !== '') {
      return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })
    }
    if (next !== undefined) {
      if (!canAssignRole(actorRole, next)) {
        return NextResponse.json({ error: '이 역할로 변경할 권한이 없습니다.' }, { status: 403 })
      }
      data.role = next === null || next === 'USER' ? null : next
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      signupMethod: true,
      socialProvider: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ user: updated })
}
