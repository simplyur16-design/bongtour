import NextAuth from 'next-auth'
import Kakao from 'next-auth/providers/kakao'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'

const isProduction = process.env.NODE_ENV === 'production'
const resolvedAuthSecret =
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  /** nginx 등 리버스 프록시 뒤에서 호스트·HTTPS를 맞추지 않으면 세션이 미들웨어에서 비어 /admin → /auth/signin 루프가 날 수 있음 */
  trustHost: true,
  secret: resolvedAuthSecret,
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
    ...(kakaoConfigured
      ? [
          Kakao({
            clientId: process.env.KAKAO_CLIENT_ID!,
            clientSecret: process.env.KAKAO_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id) return true
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
      if (user) {
        token.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
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
        (session.user as { id?: string }).id = token.id as string
        (session.user as { role?: string }).role = (token.role as string) ?? null
        ;(session.user as { accountStatus?: string }).accountStatus =
          (token.accountStatus as string) ?? 'active'
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      const role = bootstrapRoleForNewUserEmail(user.email ?? null)
      const patch: { role?: string } = {}
      if (role) patch.role = role
      if (Object.keys(patch).length > 0) {
        await prisma.user.update({ where: { id: user.id! }, data: patch })
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
})
