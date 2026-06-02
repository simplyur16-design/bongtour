/**
 * Admin tool role SSOT (User.role text column — no DB enum).
 * Operator-facing levels: ADMIN (full) · STAFF (search + inquiry respond) · null (no tool).
 */

export const ADMIN_TOOL_ROLES = ['ADMIN', 'STAFF'] as const
export type AdminToolRole = (typeof ADMIN_TOOL_ROLES)[number]

/** Session / DB role → admin tool tier (SUPER_ADMIN maps to ADMIN). */
export function normalizeAdminToolRole(role: string | null | undefined): AdminToolRole | null {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'ADMIN'
  if (role === 'STAFF') return 'STAFF'
  return null
}

export function isAdminToolRole(role: string | null | undefined): boolean {
  return normalizeAdminToolRole(role) !== null
}

/** Staff management, role elevation beyond STAFF, full admin panel. */
export function isAdminOnlyRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}
