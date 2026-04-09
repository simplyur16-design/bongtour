/**
 * Edge 미들웨어용 — Prisma·Credentials(authorize)·bcrypt 없음.
 * `middleware.ts`는 `NextAuth(authConfig)`만 import해 jose JWE/deflate 등 Node 전용 경로 번들을 피한다.
 * @see https://authjs.dev/getting-started/middleware
 */
import type { NextAuthConfig } from 'next-auth'
import Kakao from 'next-auth/providers/kakao'

const isProduction = process.env.NODE_ENV === 'production'

export const resolvedAuthSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  (!isProduction ? '__bongtour_dev_auth_secret_change_for_production__' : undefined)

if (!resolvedAuthSecret && isProduction) {
  console.error(
    '[auth] Missing AUTH_SECRET (or NEXTAUTH_SECRET). Set a strong secret in production. See .env.example.'
  )
}

if (!isProduction && resolvedAuthSecret === '__bongtour_dev_auth_secret_change_for_production__') {
  console.warn(
    '[auth] Using dev-only AUTH fallback. Set AUTH_SECRET in .env.local to silence MissingSecret and match production.'
  )
}

const kakaoConfigured = Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())

/** Credentials는 `auth.ts`에서만 추가(Prisma authorize). 미들웨어 번들에는 카카오만 포함. */
export default {
  trustHost: true,
  secret: resolvedAuthSecret,
  providers: kakaoConfigured
    ? [
        Kakao({
          clientId: process.env.KAKAO_CLIENT_ID!,
          clientSecret: process.env.KAKAO_CLIENT_SECRET!,
        }),
      ]
    : [],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = (token.role as string) ?? null
        ;(session.user as { accountStatus?: string }).accountStatus =
          (token.accountStatus as string) ?? 'active'
      }
      return session
    },
  },
} satisfies NextAuthConfig
