import {
  confirmPasswordReset,
  type ConfirmPasswordResetFailCode,
  type PasswordResetSurface,
} from '@/lib/auth/password-reset'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getClientIp } from '@/lib/admin-api-security'
import { getRateLimitStore } from '@/lib/rate-limit-store'

export const dynamic = 'force-dynamic'

/** REGRESSION-FREEZE[auth-password-reset]: confirm API — manifest */
const RATE_WINDOW_MS = 60_000
const RATE_MAX_IP = 20

const FAIL_STATUS: Record<ConfirmPasswordResetFailCode, number> = {
  invalid_email: 400,
  invalid_token: 400,
  weak_password: 400,
  expired_or_used: 400,
  no_password_account: 400,
}

function parseSurface(v: unknown): PasswordResetSurface | null {
  if (v === 'bongtour' || v === 'simplyur') return v
  return null
}

/**
 * POST /api/auth/password-reset/confirm
 * body: { email, token, password, surface }
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const store = getRateLimitStore()
  const ipBucket = await store.incr(`auth:password-reset:confirm:ip:${ip}`, RATE_WINDOW_MS)
  if (ipBucket.count > RATE_MAX_IP) {
    return jsonWithLeakGuard(
      { ok: false, code: 'expired_or_used' },
      'auth.password-reset.confirm.rate-limit',
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonWithLeakGuard(
      { ok: false, code: 'invalid_token' },
      'auth.password-reset.confirm',
      { status: 400 },
    )
  }

  const email =
    typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email
      : ''
  const token =
    typeof (body as { token?: unknown }).token === 'string'
      ? (body as { token: string }).token
      : ''
  const password =
    typeof (body as { password?: unknown }).password === 'string'
      ? (body as { password: string }).password
      : ''
  const surface = parseSurface((body as { surface?: unknown }).surface)
  if (!surface) {
    return jsonWithLeakGuard(
      { ok: false, code: 'invalid_token' },
      'auth.password-reset.confirm',
      { status: 400 },
    )
  }

  const result = await confirmPasswordReset({
    emailRaw: email,
    token,
    password,
    surface,
  })
  if (!result.ok) {
    return jsonWithLeakGuard(
      { ok: false, code: result.code },
      'auth.password-reset.confirm',
      { status: FAIL_STATUS[result.code] },
    )
  }

  return jsonWithLeakGuard({ ok: true }, 'auth.password-reset.confirm', { status: 200 })
}
