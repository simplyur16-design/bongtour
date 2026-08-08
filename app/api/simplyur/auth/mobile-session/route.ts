import { getClientIp } from '@/lib/admin-api-security'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import {
  createSimplyurMobileSessionFromAppleIdentityToken,
  createSimplyurMobileSessionFromCredentials,
  createSimplyurMobileSessionFromGoogleIdToken,
  type SimplyurMobileSessionFailCode,
} from '@/lib/simplyur/auth/mobile-session'
import {
  SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL,
  SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP,
  SIMPLYUR_MOBILE_SESSION_RATE_WINDOW_MS,
  simplyurMobileSessionEmailRateKey,
  simplyurMobileSessionIpRateKey,
} from '@/lib/simplyur/auth/mobile-session-rate-limit'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'

export const dynamic = 'force-dynamic'

const FAIL_STATUS: Record<SimplyurMobileSessionFailCode, number> = {
  invalid_payload: 400,
  invalid_credentials: 401,
  oauth_not_configured: 503,
  oauth_invalid_token: 401,
  account_restricted: 403,
}

function rateLimitedResponse(resetAt: number) {
  return jsonWithLeakGuard(
    { ok: false, code: 'rate_limited' },
    'simplyur.auth.mobile-session.rate-limit',
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
      },
    },
  )
}

/**
 * POST /api/simplyur/auth/mobile-session
 * In-app Simplyur auth — returns Bearer JWT (no Auth.js cookie / no WebBrowser).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: mobile-session route — manifest
 * REGRESSION-FREEZE[simplyur-mobile-auth-hardening]: IP/email rate limit — manifest
 *
 * body:
 *  { provider: 'credentials', email, password }
 *  { provider: 'google', idToken }
 *  { provider: 'apple', identityToken }
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const store = getRateLimitStore()
  const ipBucket = await store.incr(
    simplyurMobileSessionIpRateKey(ip),
    SIMPLYUR_MOBILE_SESSION_RATE_WINDOW_MS,
  )
  if (ipBucket.count > SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP) {
    return rateLimitedResponse(ipBucket.resetAt)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonWithLeakGuard(
      { ok: false, code: 'invalid_payload' },
      'simplyur.auth.mobile-session',
      { status: 400 },
    )
  }

  const provider =
    typeof (body as { provider?: unknown }).provider === 'string'
      ? (body as { provider: string }).provider.trim()
      : ''

  let result
  if (provider === 'credentials') {
    const email =
      typeof (body as { email?: unknown }).email === 'string' ? (body as { email: string }).email : ''
    const password =
      typeof (body as { password?: unknown }).password === 'string'
        ? (body as { password: string }).password
        : ''
    const normalizedEmail = normalizeCredentialsLoginEmail(email)
    if (normalizedEmail) {
      const emailBucket = await store.incr(
        simplyurMobileSessionEmailRateKey(normalizedEmail),
        SIMPLYUR_MOBILE_SESSION_RATE_WINDOW_MS,
      )
      if (emailBucket.count > SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL) {
        return rateLimitedResponse(emailBucket.resetAt)
      }
    }
    result = await createSimplyurMobileSessionFromCredentials({ email, password })
  } else if (provider === 'google') {
    const idToken =
      typeof (body as { idToken?: unknown }).idToken === 'string'
        ? (body as { idToken: string }).idToken
        : ''
    if (!idToken) {
      return jsonWithLeakGuard(
        { ok: false, code: 'invalid_payload' },
        'simplyur.auth.mobile-session',
        { status: 400 },
      )
    }
    result = await createSimplyurMobileSessionFromGoogleIdToken(idToken)
  } else if (provider === 'apple') {
    const identityToken =
      typeof (body as { identityToken?: unknown }).identityToken === 'string'
        ? (body as { identityToken: string }).identityToken
        : ''
    if (!identityToken) {
      return jsonWithLeakGuard(
        { ok: false, code: 'invalid_payload' },
        'simplyur.auth.mobile-session',
        { status: 400 },
      )
    }
    result = await createSimplyurMobileSessionFromAppleIdentityToken(identityToken)
  } else {
    return jsonWithLeakGuard(
      { ok: false, code: 'invalid_payload' },
      'simplyur.auth.mobile-session',
      { status: 400 },
    )
  }

  if (!result.ok) {
    return jsonWithLeakGuard(
      { ok: false, code: result.code },
      'simplyur.auth.mobile-session',
      { status: FAIL_STATUS[result.code] },
    )
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      email: result.email,
      userId: result.userId,
    },
    'simplyur.auth.mobile-session',
    { status: 200 },
  )
}
