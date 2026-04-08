import { cookies, headers } from 'next/headers'
import { auth } from '@/auth'
import {
  ADMIN_BYPASS_COOKIE_NAME,
  isAdminBypassAllowed,
  isDevAdminBypassRuntimeAllowed,
} from '@/lib/admin-bypass'
import { isMembersEditorRole, isMembersViewerRole } from '@/lib/user-role'

export type AdminSession = {
  user: { id?: string; role?: string | null }
}

const MOCK_ADMIN = { user: { id: '__mock_admin__', role: 'ADMIN' as const } } satisfies AdminSession

function isDevMockAdminEnabled(): boolean {
  return isDevAdminBypassRuntimeAllowed() && process.env.ALLOW_MOCK_ADMIN === 'true'
}

/**
 * API Route용 관리자 인증 guard.
 * - 운영: auth() 세션 + role === 'ADMIN' | 'SUPER_ADMIN' 허용.
 * - 서버간: `Authorization: Bearer <ADMIN_BYPASS_SECRET>` — Python 스케줄러 등 동일 시크릿만 (쿠키 없음).
 * - 개발: BONGTOUR_DEV_ADMIN_BYPASS=true 일 때만 — ALLOW_MOCK_ADMIN 또는 admin_bypass 쿠키(SECRET 일치).
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_BYPASS_SECRET?.trim()
  if (secret) {
    const authHeader = headers().get('authorization') ?? headers().get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      if (token === secret) {
        return { user: { id: '__service_bearer__', role: 'ADMIN' as const } }
      }
    }
  }
  const session = await auth()
  if (session?.user) {
    const role = (session.user as { role?: string | null }).role
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return session as AdminSession
    return null
  }
  if (isDevMockAdminEnabled()) {
    return MOCK_ADMIN
  }
  if (isDevAdminBypassRuntimeAllowed()) {
    const cookieVal = cookies().get(ADMIN_BYPASS_COOKIE_NAME)?.value
    if (isAdminBypassAllowed({ cookieValue: cookieVal, authQuery: undefined })) {
      return MOCK_ADMIN
    }
  }
  return null
}

/**
 * 회원 목록 등 조회 API용. STAFF·ADMIN·SUPER_ADMIN 세션 허용.
 * 개발: requireAdmin 과 동일하게 bypass 쿠키·ALLOW_MOCK_ADMIN 시 mock (미들웨어 바이패스와 정합).
 */
export async function requireMembersViewer(): Promise<AdminSession | null> {
  const session = await auth()
  const id = session?.user?.id
  const role = (session?.user as { role?: string | null } | undefined)?.role
  if (id) {
    if (isMembersViewerRole(role)) return session as AdminSession
    return null
  }
  if (isDevMockAdminEnabled()) {
    return MOCK_ADMIN
  }
  if (isDevAdminBypassRuntimeAllowed()) {
    const cookieVal = cookies().get(ADMIN_BYPASS_COOKIE_NAME)?.value
    if (isAdminBypassAllowed({ cookieValue: cookieVal, authQuery: undefined })) {
      return MOCK_ADMIN
    }
  }
  return null
}

export type MembersEditorResult =
  | { ok: true; session: AdminSession }
  | { ok: false; reason: 'unauthenticated' }
  | { ok: false; reason: 'forbidden' }

/**
 * 회원 수정(PATCH 등)용. ADMIN·SUPER_ADMIN 만 허용 (STAFF 는 조회만).
 * - 미로그인: unauthenticated
 * - STAFF 등 편집 불가 역할: forbidden
 */
export async function requireMembersEditor(): Promise<MembersEditorResult> {
  const session = await auth()
  const id = session?.user?.id
  const role = (session?.user as { role?: string | null } | undefined)?.role
  if (id) {
    if (isMembersEditorRole(role)) return { ok: true, session: session as AdminSession }
    return { ok: false, reason: 'forbidden' }
  }
  if (isDevMockAdminEnabled()) {
    return { ok: true, session: MOCK_ADMIN }
  }
  if (isDevAdminBypassRuntimeAllowed()) {
    const cookieVal = cookies().get(ADMIN_BYPASS_COOKIE_NAME)?.value
    if (isAdminBypassAllowed({ cookieValue: cookieVal, authQuery: undefined })) {
      return { ok: true, session: MOCK_ADMIN }
    }
  }
  return { ok: false, reason: 'unauthenticated' }
}
