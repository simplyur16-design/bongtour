import 'server-only'

import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export type AuthHealthProbe = {
  ok: boolean
  checks: {
    authSecret: boolean
    nextauthUrl: boolean
    databaseUrl: boolean
    kakaoClientId: boolean
    kakaoClientSecret: boolean
    naverClientId: boolean
    naverClientSecret: boolean
  }
  dbOk: boolean
  userTableOk: boolean
  jwtEncodeOk: boolean
  dbError: string | null
  jwtError: string | null
}

function resolvedAuthSecret(): string | undefined {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    undefined
  )
}

export async function probeAuthHealth(): Promise<AuthHealthProbe> {
  const checks = {
    authSecret: Boolean(resolvedAuthSecret()),
    nextauthUrl: Boolean(process.env.NEXTAUTH_URL?.trim()),
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    kakaoClientId: Boolean(process.env.KAKAO_CLIENT_ID?.trim()),
    kakaoClientSecret: Boolean(process.env.KAKAO_CLIENT_SECRET?.trim()),
    naverClientId: Boolean(process.env.NAVER_CLIENT_ID?.trim()),
    naverClientSecret: Boolean(process.env.NAVER_CLIENT_SECRET?.trim()),
  }

  let dbOk = false
  let userTableOk = false
  let jwtEncodeOk = false
  let dbError: string | null = null
  let jwtError: string | null = null

  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
    await prisma.user.findFirst({
      select: { id: true, email: true, role: true, accountStatus: true },
    })
    userTableOk = true
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
  }

  try {
    const secret = resolvedAuthSecret()
    if (secret) {
      await encode({
        token: { sub: 'auth-health-probe', id: 'auth-health-probe' },
        secret,
        salt: '__Secure-authjs.session-token',
        maxAge: 60,
      })
      jwtEncodeOk = true
    } else {
      jwtError = 'missing_auth_secret'
    }
  } catch (err) {
    jwtError = err instanceof Error ? err.message : String(err)
  }

  const ok =
    checks.authSecret &&
    checks.databaseUrl &&
    dbOk &&
    userTableOk &&
    jwtEncodeOk &&
    checks.kakaoClientId &&
    checks.kakaoClientSecret &&
    checks.naverClientId &&
    checks.naverClientSecret

  return {
    ok,
    checks,
    dbOk,
    userTableOk,
    jwtEncodeOk,
    dbError,
    jwtError,
  }
}
