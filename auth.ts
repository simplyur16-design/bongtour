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

import { runNewUserCouponBootstrap } from '@/lib/bongsim/data/new-user-coupon-bootstrap'

function authSessionCookieDomain(): string | undefined {
  try {
    return resolveOAuthStateCookieDomain(new URL(getSiteOrigin()).hostname)
  } catch {
    return undefined
  }
}

const sessionCookieDomain = authSessionCookieDomain()
const sessionCookieSecure = getSiteOrigin().startsWith('https://')
const sessionCookiePrefix = sessionCookieSecure ? '__Secure-' : ''

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...(sessionCookieDomain
    ? {
        cookies: {
          sessionToken: {
            name: `${sessionCookiePrefix}authjs.session-token`,
            options: {
              httpOnly: true,
              sameSite: 'lax' as const,
              path: '/',
              secure: sessionCookieSecure,
              domain: sessionCookieDomain,
            },
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
        const email = credentials?.email?.toString().trim().toLowerCase()
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
    ...authConfig.providers,
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (!user?.id) return true
      await ensureUserBootstrapRole(user.id, user.email ?? null)
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { accountStatus: true, signupMethod: true },
      })
      if (!row) return false
      if (row.accountStatus === 'suspended' || row.accountStatus === 'withdrawn') {
        return false
      }
      const oauth = account && account.provider !== 'credentials'
      const data: {
        lastLoginAt: Date
        socialProvider?: string
        socialProviderUserId?: string
        signupMethod?: string
      } = { lastLoginAt: new Date() }
      if (oauth && account) {
        data.socialProvider = account.provider
        data.socialProviderUserId = account.providerAccountId
        if (!row.signupMethod?.trim()) {
          data.signupMethod = account.provider
        }
      }
      await prisma.user.update({ where: { id: user.id }, data })
      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id
      }
      const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
      if (!userId) return token

      token.id = userId

      /** 로그인·세션 갱신 시에만 DB — `/api/auth/session` 폴링마다 Prisma 2회 호출하지 않음 */
      const shouldRefreshRoleFromDb =
        Boolean(user?.id) || trigger === 'update' || token.role == null || token.accountStatus == null

      if (shouldRefreshRoleFromDb) {
        const email = (user?.email as string | undefined) ?? (token.email as string | undefined)
        await ensureUserBootstrapRole(userId, email ?? null)
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, accountStatus: true },
        })
        token.role = dbUser?.role ?? null
        token.accountStatus = dbUser?.accountStatus ?? 'active'
      }

      if (trigger === 'update' && session) {
        token.role = (session as { role?: string }).role ?? token.role
      }
      return token
    },
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
  events: {
    async createUser({ user }) {
      const pending = await prisma.user.findUnique({
        where: { id: user.id! },
        select: { accountStatus: true },
      })
      if (pending?.accountStatus === 'consent_pending') return

      const role = bootstrapRoleForNewUserEmail(user.email ?? null)
      const patch: { role?: string } = {}
      if (role) patch.role = role
      if (Object.keys(patch).length > 0) {
        await prisma.user.update({ where: { id: user.id! }, data: patch })
      }
      void runNewUserCouponBootstrap(user.id!).then((r) => {
        if (!r.welcomeIssued && r.reason !== 'ok') {
          console.warn('[auth:createUser] coupon_bootstrap', r.reason)
        }
      }).catch((e) => {
        console.warn('[auth:createUser] coupon_bootstrap', e)
      })
    },
  },
})
