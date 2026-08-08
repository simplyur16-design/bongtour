import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { ensureUserBootstrapRole } from '@/lib/ensure-user-bootstrap-role'
import authConfig from './auth.config'
import { getSiteOrigin } from '@/lib/site-metadata'
import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'
import {
  authJsCookieOptions,
  authJsCookiePrefix,
  authJsOAuthCookieOptions,
} from '@/lib/auth/auth-js-cookie-options'

import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'
import { googleOAuthProvider } from '@/lib/auth/google-oauth-provider'
import { appleOAuthProvider } from '@/lib/auth/apple-oauth-provider'

function authSessionCookieDomain(): string | undefined {
  try {
    const hostname = new URL(getSiteOrigin()).hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return undefined
    }
    return resolveOAuthStateCookieDomain(hostname)
  } catch {
    return undefined
  }
}

function authSessionCookieSecure(): boolean {
  try {
    const hostname = new URL(getSiteOrigin()).hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return false
    }
    return getSiteOrigin().startsWith('https://')
  } catch {
    return false
  }
}

const sessionCookieDomain = authSessionCookieDomain()
const sessionCookieSecure = authSessionCookieSecure()
const sessionCookiePrefix = authJsCookiePrefix()
const sharedCookieOptions = authJsCookieOptions()
const oauthCookieOptions = authJsOAuthCookieOptions()

const googleProvider = googleOAuthProvider()
const appleProvider = appleOAuthProvider()

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...(sessionCookieDomain
    ? {
        cookies: {
          sessionToken: {
            name: `${sessionCookiePrefix}authjs.session-token`,
            options: sharedCookieOptions,
          },
          // Cross-site OAuth return (esp. Apple form_post) — not Lax
          pkceCodeVerifier: {
            name: `${sessionCookiePrefix}authjs.pkce.code_verifier`,
            options: oauthCookieOptions,
          },
          state: {
            name: `${sessionCookiePrefix}authjs.state`,
            options: oauthCookieOptions,
          },
          nonce: {
            name: `${sessionCookiePrefix}authjs.nonce`,
            options: oauthCookieOptions,
          },
          callbackUrl: {
            name: `${sessionCookiePrefix}authjs.callback-url`,
            options: oauthCookieOptions,
          },
        },
      }
    : {}),
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const email = normalizeCredentialsLoginEmail(credentials?.email?.toString() ?? '')
        const password = credentials?.password?.toString() ?? ''
        if (!email || !password) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) return null
        if (user.accountStatus !== 'active') return null
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
    ...(googleProvider ? [googleProvider] : []),
    ...(appleProvider ? [appleProvider] : []),
    ...authConfig.providers,
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      const isOAuth = Boolean(account && account.provider !== 'credentials')

      /** Google 등 OAuth — DB user 생성 전엔 profile id만 있을 수 있음 */
      if (!user?.id || isOAuth) {
        if (isOAuth && user?.email) {
          const row = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, accountStatus: true, signupMethod: true },
          })
          if (row) {
            if (row.accountStatus === 'suspended' || row.accountStatus === 'withdrawn') {
              return false
            }
            await prisma.user.update({
              where: { id: row.id },
              data: {
                lastLoginAt: new Date(),
                socialProvider: account!.provider,
                socialProviderUserId: account!.providerAccountId,
                ...(row.signupMethod?.trim() ? {} : { signupMethod: account!.provider }),
              },
            })
          }
        }
        return true
      }

      await ensureUserBootstrapRole(user.id, user.email ?? null)
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { accountStatus: true, signupMethod: true },
      })
      if (!row) return false
      if (row.accountStatus === 'suspended' || row.accountStatus === 'withdrawn') {
        return false
      }
      const data: {
        lastLoginAt: Date
        socialProvider?: string
        socialProviderUserId?: string
        signupMethod?: string
      } = { lastLoginAt: new Date() }
      await prisma.user.update({ where: { id: user.id }, data })
      return true
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user?.id) {
        token.id = user.id
      } else if (account && account.provider !== 'credentials') {
        /** REGRESSION-FREEZE[oauth-jwt-oauth-user-id]: OAuth JWT email→user.id — simplyur mypage 401 — manifest */
        const email =
          (user?.email as string | undefined)?.trim().toLowerCase() ??
          (typeof token.email === 'string' ? token.email.trim().toLowerCase() : '')
        if (email && !token.id) {
          const row = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
          })
          if (row?.id) token.id = row.id
        }
      }
      const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
      if (!userId) return token

      token.id = userId

      /** 로그인·세션 갱신 시에만 DB — `/api/auth/session` 폴링마다 Prisma 2회 호출하지 않음 */
      const shouldRefreshRoleFromDb =
        Boolean(user?.id) ||
        trigger === 'update' ||
        token.role == null ||
        token.accountStatus == null ||
        token.affiliationVerified == null

      if (shouldRefreshRoleFromDb) {
        const email = (user?.email as string | undefined) ?? (token.email as string | undefined)
        await ensureUserBootstrapRole(userId, email ?? null)
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, accountStatus: true, affiliationVerified: true },
        })
        token.role = dbUser?.role ?? null
        token.accountStatus = dbUser?.accountStatus ?? 'active'
        token.affiliationVerified = Boolean(dbUser?.affiliationVerified)
      }

      if (trigger === 'update' && session) {
        token.role = (session as { role?: string }).role ?? token.role
        if (typeof (session as { affiliationVerified?: boolean }).affiliationVerified === 'boolean') {
          token.affiliationVerified = (session as { affiliationVerified: boolean }).affiliationVerified
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = (token.role as string) ?? null
        ;(session.user as { accountStatus?: string }).accountStatus =
          (token.accountStatus as string) ?? 'active'
        ;(session.user as { affiliationVerified?: boolean }).affiliationVerified = Boolean(
          token.affiliationVerified,
        )
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      try {
        const pending = await prisma.user.findUnique({
          where: { id: user.id! },
          select: { accountStatus: true },
        })
        if (!pending) return
        if (pending.accountStatus === 'consent_pending') return

        const role = bootstrapRoleForNewUserEmail(user.email ?? null)
        const patch: { role?: string } = {}
        if (role) patch.role = role
        if (Object.keys(patch).length > 0) {
          await prisma.user.update({ where: { id: user.id! }, data: patch })
        }
        void runNewUserCouponBootstrap(user.id!)
          .then((r) => {
            if (!r.welcomeIssued && r.reason !== 'ok') {
              console.warn('[auth:createUser] coupon_bootstrap', r.reason)
            }
          })
          .catch((e) => {
            console.warn('[auth:createUser] coupon_bootstrap', e)
          })
      } catch (e) {
        console.error('[auth:createUser]', e)
      }
    },
  },
})
