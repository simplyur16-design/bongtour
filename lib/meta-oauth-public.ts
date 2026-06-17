import { timingSafeEqual } from 'crypto'

export const META_OAUTH_STATE_COOKIE = 'meta_oauth_state'

export function safeMetaStateEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

export function oauthCookieSecureFromRequest(request: Request): boolean {
  const u = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim()
  if (u?.startsWith('https://')) return true
  const forwarded = (request.headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  if (forwarded === 'https') return true
  return new URL(request.url).protocol === 'https:'
}
