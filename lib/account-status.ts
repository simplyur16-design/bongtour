export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended', 'withdrawn'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export function displayAccountStatus(s: string): string {
  switch (s) {
    case 'active':
      return '활성'
    case 'inactive':
      return '비활성'
    case 'suspended':
      return '정지'
    case 'withdrawn':
      return '탈퇴'
    default:
      return s
  }
}

export function isAccountStatus(v: string): v is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(v)
}

/** Suspended / withdrawn — block login and API access. */
export function isRestrictedAccountStatus(status: string | null | undefined): boolean {
  return status === 'suspended' || status === 'withdrawn'
}
