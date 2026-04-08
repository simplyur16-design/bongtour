import type { UserRole } from '@/lib/user-role'
import { USER_ROLES, isSuperAdminRole } from '@/lib/user-role'

export type PatchMemberBody = {
  role?: string | null
  accountStatus?: string
}

/**
 * 역할 변경 권한.
 * - SUPER_ADMIN만 ADMIN·SUPER_ADMIN 부여/해제 가능(다른 SUPER_ADMIN 간 조정 포함은 동일 규칙).
 * - ADMIN·SUPER_ADMIN은 USER·STAFF·ADMIN(후자는 SUPER_ADMIN만) 범위에서 조정.
 * - 본인 역할은 바꾸지 못하게 호출부에서 막음.
 */
export function canAssignRole(actorRole: string | null | undefined, nextRole: UserRole | null): boolean {
  const superA = isSuperAdminRole(actorRole)
  const adminA = actorRole === 'ADMIN' || superA

  if (nextRole === 'SUPER_ADMIN' || nextRole === 'ADMIN') {
    return superA
  }
  if (nextRole === null || nextRole === 'USER' || nextRole === 'STAFF') {
    return adminA
  }
  return false
}

export function normalizeRoleInput(v: unknown): UserRole | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const u = v.toUpperCase()
  if ((USER_ROLES as readonly string[]).includes(u)) return u as UserRole
  return undefined
}
