/** DB·세션에 저장되는 역할 문자열 (대문자 권장) */
export const USER_ROLES = ['USER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export function displayRole(role: string | null | undefined): string {
  if (!role || role === 'USER') return '일반'
  if (role === 'STAFF') return '스태프'
  if (role === 'ADMIN') return '관리자'
  if (role === 'SUPER_ADMIN') return '최고관리자'
  return role
}

/** 관리자 패널(상품·설정 등) — STAFF 제외 */
export function isAdminPanelRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/** 회원 관리 메뉴 조회 */
export function isMembersViewerRole(role: string | null | undefined): boolean {
  return role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/** 회원 정보 수정(역할·상태) */
export function isMembersEditorRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN'
}

export function parseRoleListEnv(v: string | undefined): string[] {
  if (!v?.trim()) return []
  return v
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function emailMatchesEnvList(email: string | null | undefined, list: string[]): boolean {
  if (!email) return false
  const lower = email.toLowerCase()
  return list.some((e) => e === lower)
}
