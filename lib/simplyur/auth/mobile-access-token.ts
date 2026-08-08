/**
 * simplyur app Bearer access token (HS256) — RN SecureStore, not Auth.js cookies.
 * REGRESSION-FREEZE[simplyur-inapp-auth]: mobile JWT mint/verify — manifest
 */
import { SignJWT, jwtVerify } from 'jose'
import { resolvedAuthSecret } from '@/auth.config'

export const SIMPLYUR_MOBILE_TOKEN_ISS = 'simplyur-mobile'
export const SIMPLYUR_MOBILE_TOKEN_AUD = 'simplyur-app'
export const SIMPLYUR_MOBILE_TOKEN_TYP = 'simplyur_mobile'

export type SimplyurMobileAccessClaims = {
  userId: string
  email: string
}

function secretKey(): Uint8Array {
  const secret = resolvedAuthSecret?.trim()
  if (!secret) throw new Error('auth_secret_missing')
  return new TextEncoder().encode(secret)
}

export async function mintSimplyurMobileAccessToken(
  claims: SimplyurMobileAccessClaims,
  expiresIn: string = '30d',
): Promise<{ accessToken: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({
    email: claims.email,
    typ: SIMPLYUR_MOBILE_TOKEN_TYP,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(SIMPLYUR_MOBILE_TOKEN_ISS)
    .setAudience(SIMPLYUR_MOBILE_TOKEN_AUD)
    .setIssuedAt(now)
    .setExpirationTime(expiresIn)
    .sign(secretKey())

  const verified = await jwtVerify(token, secretKey(), {
    issuer: SIMPLYUR_MOBILE_TOKEN_ISS,
    audience: SIMPLYUR_MOBILE_TOKEN_AUD,
  })
  const exp = typeof verified.payload.exp === 'number' ? verified.payload.exp : now + 30 * 86400
  return { accessToken: token, expiresAt: exp }
}

export async function verifySimplyurMobileAccessToken(
  token: string,
): Promise<SimplyurMobileAccessClaims | null> {
  const raw = token.trim()
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(raw, secretKey(), {
      issuer: SIMPLYUR_MOBILE_TOKEN_ISS,
      audience: SIMPLYUR_MOBILE_TOKEN_AUD,
    })
    if (payload.typ !== SIMPLYUR_MOBILE_TOKEN_TYP) return null
    const userId = typeof payload.sub === 'string' ? payload.sub.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    // userId is the auth gate; email optional (Apple Hide My Email / empty DB column).
    if (!userId) return null
    return { userId, email: email.includes('@') ? email : '' }
  } catch {
    return null
  }
}

export function readBearerToken(req: Request): string {
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m?.[1]?.trim() ?? ''
}
