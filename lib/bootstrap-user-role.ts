import { emailMatchesEnvList, parseRoleListEnv } from '@/lib/user-role'

/** 쉼표 구분. 최고관리자 부트스트랩(첫 로그인 시 role 후보). */
export function superAdminEmailList(): string[] {
  return parseRoleListEnv(process.env.SUPER_ADMIN_EMAIL)
}

const ADMIN_EMAILS = ['simplyur@naver.com', process.env.ADMIN_EMAIL].filter(Boolean) as string[]

export function isAdminBootstrapEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.toLowerCase()
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === lower)
}

export function isSuperAdminBootstrapEmail(email: string | null | undefined): boolean {
  return emailMatchesEnvList(email, superAdminEmailList())
}

/** OAuth/이메일 최초 유저 생성 직후: 환경변수 기반 역할 부여 */
export function bootstrapRoleForNewUserEmail(email: string | null | undefined): string | null {
  if (isSuperAdminBootstrapEmail(email)) return 'SUPER_ADMIN'
  if (isAdminBootstrapEmail(email)) return 'ADMIN'
  return null
}
