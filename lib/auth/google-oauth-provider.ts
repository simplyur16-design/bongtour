import Google from 'next-auth/providers/google'
import type { Provider } from 'next-auth/providers'

function readGoogleOAuthEnv() {
  const clientId =
    process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || ''
  const clientSecret =
    process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || ''
  return { clientId, clientSecret }
}

/** Google OAuth Web client — simplyur 모바일 앱·NextAuth `/api/auth/callback/google` */
export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = readGoogleOAuthEnv()
  return Boolean(clientId && clientSecret)
}

export function googleOAuthProvider(): Provider | null {
  const { clientId, clientSecret } = readGoogleOAuthEnv()
  if (!clientId || !clientSecret) return null
  return Google({
    clientId,
    clientSecret,
    /** 게스트 구매 이메일과 동일 Google 계정 연결 (simplyur My eSIM) */
    allowDangerousEmailAccountLinking: true,
  })
}
