/**
 * 워커 ingest가 등록 API를 부를 공개 origin.
 * getSiteOrigin() 로컬 폴백을 쓰면 워커에서 그날 수집이 실패한다.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 워커 localhost 금지 — manifest
 */

const PUBLIC_REGISTER_INGEST_ORIGIN = 'https://bongtour.com'

export function isLoopbackHttpOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.trim().toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0'
  } catch {
    return true
  }
}

function normalizeHttpOrigin(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  let s = t.replace(/\/$/, '')
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, '')}`
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

export function getRegisterIngestApiOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.REGISTER_INGEST_API_ORIGIN,
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXTAUTH_URL,
  ]
  for (const raw of candidates) {
    const origin = normalizeHttpOrigin(raw)
    if (origin && !isLoopbackHttpOrigin(origin)) return origin
  }
  if (env.NODE_ENV === 'production') return PUBLIC_REGISTER_INGEST_ORIGIN
  const local = normalizeHttpOrigin(env.NEXTAUTH_URL) ?? 'http://localhost:3000'
  return local
}
