function stripTrailingSlash(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function isLoopbackAuthOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** Bong투어 `/auth/error?error=Configuration` — 운영·로컬 안내 분리 (콜백 URL은 환경마다 다름) */
export function oauthConfigurationErrorDescriptionKo(siteOrigin: string): string {
  const base = stripTrailingSlash(siteOrigin)
  if (isLoopbackAuthOrigin(base)) {
    return (
      `OAuth 설정·쿠키·redirect URI 문제입니다. ` +
      `로컬 전용: NEXTAUTH_URL=${base}, Google Console redirect=${base}/api/auth/callback/google ` +
      `(운영 URL과 별도 등록). ` +
      `Apple Sign In은 Services ID에 bongtour.com만 등록된 경우 로컬 콜백이 동작하지 않습니다 — ` +
      `Apple/Google 테스트는 NEXTAUTH_URL=https://bongtour.com(운영) 또는 simplyur 앱에서 진행하세요. ` +
      `시크릿 창으로 재시도.`
    )
  }
  return (
    `OAuth 서버 설정 문제입니다(운영 전용 콜백). Railway env: NEXTAUTH_URL=${base}, AUTH_SECRET, ` +
    `AUTH_APPLE_PRIVATE_KEY(.p8 전체), Google client secret. ` +
    `Google redirect: ${base}/api/auth/callback/google · ` +
    `Apple Return URL: ${base}/api/auth/callback/apple ` +
    `(로컬 localhost 콜백과는 별개 — Console·Apple Developer에 위 URL만 등록). 시크릿 창으로 재시도.`
  )
}

/** simplyur `/simplyur/.../auth/error?error=Configuration` */
export function oauthConfigurationErrorHintEn(siteOrigin: string): string {
  const base = stripTrailingSlash(siteOrigin)
  if (isLoopbackAuthOrigin(base)) {
    return (
      `OAuth misconfiguration (local). Use NEXTAUTH_URL=${base} and Google redirect ` +
      `${base}/api/auth/callback/google only — separate from production. ` +
      `Apple Sign In usually requires https://bongtour.com; test social login on production or in the app with EXPO_PUBLIC_API_BASE_URL=https://bongtour.com.`
    )
  }
  return (
    `OAuth server misconfiguration (production). Check NEXTAUTH_URL=${base}, AUTH_SECRET, Apple .p8 key, Google secret. ` +
    `Production callbacks only: ${base}/api/auth/callback/google and ${base}/api/auth/callback/apple — not localhost.`
  )
}
