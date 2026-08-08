import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import {
  registerSimplyurEmailUser,
  type SimplyurEmailRegisterFailCode,
} from '@/lib/simplyur/auth/register-email'

export const dynamic = 'force-dynamic'

const FAIL_STATUS: Record<SimplyurEmailRegisterFailCode, number> = {
  invalid_email: 400,
  weak_password: 400,
  terms_required: 400,
  email_taken: 409,
}

/**
 * POST /api/simplyur/auth/register
 * Foreign-visitor email signup only. Domestic `/api/auth/register` remains 410.
 * REGRESSION-FREEZE[simplyur-email-signup]: simplyur register API — manifest
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonWithLeakGuard(
      { ok: false, code: 'invalid_email' },
      'simplyur.auth.register',
      { status: 400 },
    )
  }

  const email = typeof (body as { email?: unknown }).email === 'string' ? (body as { email: string }).email : ''
  const password =
    typeof (body as { password?: unknown }).password === 'string' ? (body as { password: string }).password : ''
  const termsAccepted = Boolean((body as { termsAccepted?: unknown }).termsAccepted)

  const result = await registerSimplyurEmailUser({ email, password, termsAccepted })
  if (!result.ok) {
    return jsonWithLeakGuard(
      { ok: false, code: result.code },
      'simplyur.auth.register',
      { status: FAIL_STATUS[result.code] },
    )
  }

  return jsonWithLeakGuard(
    { ok: true, email: result.email },
    'simplyur.auth.register',
    { status: 201 },
  )
}
