/**
 * confirm 저장 전에 반드시 preview를 거쳤는지 검증하는 HMAC 토큰.
 *
 * - development: REGISTRATION_PREVIEW_SECRET → AUTH_SECRET/NEXTAUTH_SECRET → 개발 전용 fallback 문자열 순
 * - production: REGISTRATION_PREVIEW_SECRET 또는 (개발 플레이스홀더가 아닌) AUTH_SECRET/NEXTAUTH_SECRET 필수.
 *   누락 시 issue/verify 호출 시 즉시 오류(폴백 문자열 사용 불가).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const DEV_PREVIEW_FALLBACK = 'dev-only-registration-preview-change-me'
/** auth.ts 의 로컬 개발 기본 AUTH_SECRET 과 동일하면 운영에서 preview secret 으로 인정하지 않음 */
const DEV_AUTH_SECRET_PLACEHOLDER = '__bongtour_dev_auth_secret_change_for_production__'

function resolvePreviewSecret(): string {
  const explicit = process.env.REGISTRATION_PREVIEW_SECRET?.trim()
  const auth = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()

  if (process.env.NODE_ENV === 'production') {
    if (explicit && explicit.length > 0) return explicit
    if (auth && auth.length > 0 && auth !== DEV_AUTH_SECRET_PLACEHOLDER) return auth
    throw new Error(
      '[registration-preview-token] production에서는 REGISTRATION_PREVIEW_SECRET(권장) 또는 AUTH_SECRET/NEXTAUTH_SECRET(개발 플레이스홀더 제외)이 필수입니다. 배포 환경 변수를 확인하세요.'
    )
  }

  return explicit || auth || DEV_PREVIEW_FALLBACK
}

/** 운영 기동 시점 검증용(선택). production 이 아니면 no-op. */
export function ensureRegistrationPreviewSecretForProduction(): void {
  if (process.env.NODE_ENV !== 'production') return
  resolvePreviewSecret()
}

export function issuePreviewToken(originSource: string, originCode: string): string {
  const ts = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const payload = `${encodeURIComponent(originSource)}|${encodeURIComponent(originCode)}|${ts}|${nonce}`
  const secret = resolvePreviewSecret()
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`
}

export function verifyPreviewToken(
  token: string,
  originSource: string,
  originCode: string,
  maxAgeMs = 45 * 60 * 1000
): boolean {
  if (!token || typeof token !== 'string') return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload: string
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  } catch {
    return false
  }
  let secret: string
  try {
    secret = resolvePreviewSecret()
  } catch {
    return false
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  const parts = payload.split('|')
  if (parts.length !== 4) return false
  const os = decodeURIComponent(parts[0])
  const oc = decodeURIComponent(parts[1])
  const ts = Number(parts[2])
  if (os !== originSource || oc !== originCode) return false
  if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return false
  return true
}
