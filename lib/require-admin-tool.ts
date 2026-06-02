import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import {
  ADMIN_BYPASS_COOKIE_NAME,
  isAdminBypassAllowed,
  isDevAdminBypassRuntimeAllowed,
} from '@/lib/admin-bypass'
import { isAdminOnlyRole, isAdminToolRole } from '@/lib/admin-roles'
import type { AdminSession } from '@/lib/require-admin'

const MOCK_ADMIN = { user: { id: '__mock_admin__', role: 'ADMIN' as const } } satisfies AdminSession
function devBypassSession(): AdminSession | null {
  if (isDevAdminBypassRuntimeAllowed()) {
    if (process.env.ALLOW_MOCK_ADMIN === 'true') return MOCK_ADMIN
    return null
  }
  return null
}

async function devBypassCookieSession(): Promise<AdminSession | null> {
  if (!isDevAdminBypassRuntimeAllowed()) return null
  const c = await cookies()
  const cookieVal = c.get(ADMIN_BYPASS_COOKIE_NAME)?.value
  if (isAdminBypassAllowed({ cookieValue: cookieVal, authQuery: undefined })) {
    return MOCK_ADMIN
  }
  return null
}

async function serviceBearerFromHeaders(): Promise<AdminSession | null> {
  const secret = getAdminServiceBearerSecret()
  if (!secret) return null
  const h = await headers()
  const authHeader = h.get('authorization') ?? h.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  if (authHeader.slice(7).trim() === secret) {
    return { user: { id: '__service_bearer__', role: 'ADMIN' as const } }
  }
  return null
}

/**
 * ADMIN · STAFF — 인라인 빠른 도구·문의 응답 API.
 */
export async function requireAdminToolSession(): Promise<AdminSession | null> {
  const bearer = await serviceBearerFromHeaders()
  if (bearer) return bearer

  const session = await auth()
  const role = (session?.user as { role?: string | null } | undefined)?.role
  if (session?.user?.id && isAdminToolRole(role)) {
    return session as AdminSession
  }

  const mock = devBypassSession()
  if (mock) return mock
  const bypass = await devBypassCookieSession()
  if (bypass) return bypass

  return null
}

/**
 * ADMIN (및 SUPER_ADMIN) — STAFF 승격·권한 변경 등.
 */
export async function requireAdminOnlySession(): Promise<AdminSession | null> {
  const bearer = await serviceBearerFromHeaders()
  if (bearer) return bearer

  const session = await auth()
  const role = (session?.user as { role?: string | null } | undefined)?.role
  if (session?.user?.id && isAdminOnlyRole(role)) {
    return session as AdminSession
  }

  const mock = devBypassSession()
  if (mock) return mock
  const bypass = await devBypassCookieSession()
  if (bypass) return bypass

  return null
}

export async function requireAdminToolApi(): Promise<AdminSession | NextResponse> {
  const session = await requireAdminToolSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  return session
}

export async function requireAdminOnlyApi(): Promise<AdminSession | NextResponse> {
  const session = await requireAdminOnlySession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  return session
}
