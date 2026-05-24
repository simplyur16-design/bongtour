import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'

const ROLE_RANK: Record<string, number> = {
  USER: 0,
  STAFF: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
}

/**
 * 로그인 시 ADMIN_EMAIL / SUPER_ADMIN_EMAIL / simplyur@naver.com 등 부트스트랩 대상이면
 * DB role 을 올린다(기존 USER·STAFF 계정 포함). JWT·OAuth 세션에는 이후 조회한 role 을 넣는다.
 */
export async function ensureUserBootstrapRole(
  userId: string,
  email: string | null | undefined,
): Promise<string | null> {
  const target = bootstrapRoleForNewUserEmail(email)
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!row) return null
  const current = row.role ?? 'USER'
  if (!target) return current
  const curRank = ROLE_RANK[current] ?? 0
  const tgtRank = ROLE_RANK[target] ?? 0
  if (tgtRank <= curRank) return current
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: target },
    select: { role: true },
  })
  return updated.role
}
