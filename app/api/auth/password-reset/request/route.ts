import { getClientIp } from '@/lib/admin-api-security'
import {
  requestPasswordReset,
  type PasswordResetClient,
  type PasswordResetSurface,
} from '@/lib/auth/password-reset'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { isSimplyurLocale } from '@/lib/simplyur/constants'

export const dynamic = 'force-dynamic'

/** REGRESSION-FREEZE[auth-password-reset]: request API — manifest */
const RATE_WINDOW_MS = 60_000
const RATE_MAX_IP = 10
const RATE_MAX_EMAIL = 5

function parseSurface(v: unknown): PasswordResetSurface | null {
  if (v === 'bongtour' || v === 'simplyur') return v
  return null
}

function parseClient(v: unknown): PasswordResetClient {
  return v === 'mobile' ? 'mobile' : 'web'
}

/**
 * POST /api/auth/password-reset/request
 * Always returns { ok: true } (no email enumeration).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const store = getRateLimitStore()
  const ipBucket = await store.incr(`auth:password-reset:ip:${ip}`, RATE_WINDOW_MS)
  if (ipBucket.count > RATE_MAX_IP) {
    return jsonWithLeakGuard(
      { ok: true },
      'auth.password-reset.request.rate-limit',
      { status: 200 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonWithLeakGuard({ ok: true }, 'auth.password-reset.request', { status: 200 })
  }

  const emailRaw =
    typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email
      : ''
  const surface = parseSurface((body as { surface?: unknown }).surface)
  if (!surface) {
    return jsonWithLeakGuard({ ok: true }, 'auth.password-reset.request', { status: 200 })
  }

  const emailKey = emailRaw.trim().toLowerCase().slice(0, 254) || 'unknown'
  const emailBucket = await store.incr(`auth:password-reset:email:${emailKey}`, RATE_WINDOW_MS)
  if (emailBucket.count > RATE_MAX_EMAIL) {
    return jsonWithLeakGuard({ ok: true }, 'auth.password-reset.request.rate-limit', {
      status: 200,
    })
  }

  const localeRaw =
    typeof (body as { locale?: unknown }).locale === 'string'
      ? (body as { locale: string }).locale
      : undefined
  const locale = localeRaw && isSimplyurLocale(localeRaw) ? localeRaw : undefined
  const client = parseClient((body as { client?: unknown }).client)

  await requestPasswordReset({
    emailRaw,
    surface,
    locale,
    client,
  })

  return jsonWithLeakGuard({ ok: true }, 'auth.password-reset.request', { status: 200 })
}
