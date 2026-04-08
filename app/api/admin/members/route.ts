import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMembersViewer } from '@/lib/require-admin'

/**
 * 회원 목록 (스태프 이상). 필터: q, signupMethod, role, accountStatus
 */
export async function GET(req: Request) {
  const session = await requireMembersViewer()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const signupMethod = searchParams.get('signupMethod')?.trim()
  const roleFilter = searchParams.get('role')?.trim()
  const accountStatus = searchParams.get('accountStatus')?.trim()

  const and: Record<string, unknown>[] = []
  if (q) {
    and.push({
      OR: [{ email: { contains: q } }, { name: { contains: q } }],
    })
  }
  if (signupMethod && signupMethod !== 'all') {
    and.push({ signupMethod })
  }
  if (roleFilter && roleFilter !== 'all') {
    if (roleFilter === 'user') {
      and.push({ OR: [{ role: null }, { role: 'USER' }] })
    } else if (roleFilter === 'admin') {
      and.push({ OR: [{ role: 'ADMIN' }, { role: 'SUPER_ADMIN' }] })
    } else {
      and.push({ role: roleFilter.toUpperCase() })
    }
  }
  if (accountStatus && accountStatus !== 'all') {
    and.push({ accountStatus })
  }
  const where = and.length > 0 ? { AND: and } : {}

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      signupMethod: true,
      socialProvider: true,
      socialProviderUserId: true,
      accountStatus: true,
      privacyNoticeConfirmedAt: true,
      privacyNoticeVersion: true,
      marketingConsent: true,
      marketingConsentAt: true,
      marketingConsentVersion: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { accounts: true } },
    },
  })

  return NextResponse.json({ users })
}
