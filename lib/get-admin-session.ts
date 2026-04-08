import { isDevAdminBypassRuntimeAllowed } from '@/lib/admin-bypass'

export type AdminSession = {
  user: {
    id?: string | null
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
} | null

export const MOCK_ADMIN_SESSION_ID = '__mock_admin__'
const MOCK_ADMIN_USER = {
  id: MOCK_ADMIN_SESSION_ID,
  name: '임시관리자 (개발)',
  email: null as string | null,
  image: null as string | null,
  role: 'ADMIN' as const,
}

function isDevMockAdminEnabled(): boolean {
  return isDevAdminBypassRuntimeAllowed() && process.env.ALLOW_MOCK_ADMIN === 'true'
}

/**
 * 관리자 페이지용 세션.
 * mock: BONGTOUR_DEV_ADMIN_BYPASS=true 이고 ALLOW_MOCK_ADMIN=true 일 때만 세션 없으면 mock.
 */
export async function getAdminSession(): Promise<AdminSession> {
  try {
    const { auth } = await import('@/auth')
    if (typeof auth !== 'function') {
      if (isDevMockAdminEnabled()) {
        return { user: MOCK_ADMIN_USER }
      }
      return null
    }
    const session = await auth()
    if (session) return session as AdminSession
  } catch (_) {
    // auth 로드 실패 시 mock은 ALLOW_MOCK_ADMIN + dev bypass 플래그에서만
  }
  if (isDevMockAdminEnabled()) {
    return { user: MOCK_ADMIN_USER }
  }
  return null
}
