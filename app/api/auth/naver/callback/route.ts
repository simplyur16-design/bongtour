import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import { appendNaverSessionCookie, redirectAfterNaverLogin } from '@/lib/naver-auth-session'
import type { NaverTokenResponse, NaverProfileResponse } from '@/lib/naver-oauth-types'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const TOKEN_URL = 'https://nid.naver.com/oauth2.0/token'
const PROFILE_URL = 'https://openapi.naver.com/v1/nid/me'
const STATE_COOKIE = 'naver_oauth_state'
const REDIRECT_COOKIE = 'naver_oauth_redirect'

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, ...(detail !== undefined ? { detail } : {}) },
    { status }
  )
}

function safeStateEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

function safeRedirectPath(raw: string | undefined): string {
  if (!raw) return '/'
  try {
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/'
    return decoded
  } catch {
    return '/'
  }
}

function expiresAtFromToken(t: NaverTokenResponse): number | null {
  const raw = t.expires_in
  if (raw === undefined || raw === null) return null
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.floor(Date.now() / 1000) + n
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const oauthErr = searchParams.get('error')
  const oauthErrDesc = searchParams.get('error_description')
  if (oauthErr) {
    return jsonError(400, '네이버 인증 오류', oauthErrDesc ?? oauthErr)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!state) {
    return jsonError(400, 'state 파라미터가 없습니다.')
  }

  const cookieStore = cookies()
  const savedState = cookieStore.get(STATE_COOKIE)?.value
  if (!savedState || !safeStateEqual(savedState, state)) {
    return jsonError(400, 'state가 일치하지 않습니다.')
  }

  if (!code) {
    return jsonError(400, 'code 파라미터가 없습니다.')
  }

  const redirectPath = safeRedirectPath(cookieStore.get(REDIRECT_COOKIE)?.value)

  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  const redirectUri = process.env.NAVER_CALLBACK_URL?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    return jsonError(500, '네이버 OAuth 환경 변수가 누락되었습니다.')
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: tokenBody.toString(),
    cache: 'no-store',
  })

  const tokenJson = (await tokenRes.json()) as NaverTokenResponse
  if (!tokenRes.ok || tokenJson.error) {
    return jsonError(
      400,
      '액세스 토큰 발급에 실패했습니다.',
      tokenJson.error_description ?? tokenJson.error ?? tokenRes.statusText
    )
  }

  const accessToken = tokenJson.access_token?.trim()
  if (!accessToken) {
    return jsonError(400, '액세스 토큰 응답에 access_token이 없습니다.')
  }

  const profileRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const profileJson = (await profileRes.json()) as NaverProfileResponse
  if (!profileRes.ok || profileJson.resultcode !== '00') {
    return jsonError(400, '프로필 조회에 실패했습니다.', profileJson.message ?? profileRes.statusText)
  }

  const naverId = profileJson.response?.id
  if (!naverId) {
    return jsonError(400, '프로필 응답에 response.id가 없습니다.')
  }

  const emailRaw = profileJson.response.email?.trim().toLowerCase()
  const name = profileJson.response.name ?? profileJson.response.nickname ?? null
  const image = profileJson.response.profile_image ?? null

  const tokenPatch = {
    access_token: tokenJson.access_token ?? null,
    refresh_token: tokenJson.refresh_token ?? null,
    expires_at: expiresAtFromToken(tokenJson),
    token_type: tokenJson.token_type ?? null,
  }

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'naver', providerAccountId: naverId } },
    include: { user: true },
  })

  let userId: string

  if (linked) {
    const u = linked.user
    if (u.accountStatus === 'suspended' || u.accountStatus === 'withdrawn') {
      return jsonError(403, '이용이 제한된 계정입니다.')
    }
    await prisma.user.update({
      where: { id: u.id },
      data: {
        lastLoginAt: new Date(),
        socialProvider: 'naver',
        socialProviderUserId: naverId,
        ...(name && !u.name ? { name } : {}),
        ...(image && !u.image ? { image } : {}),
        ...(emailRaw && !u.email ? { email: emailRaw } : {}),
        ...(!u.signupMethod?.trim() ? { signupMethod: 'naver' } : {}),
      },
    })
    await prisma.account.update({
      where: { id: linked.id },
      data: tokenPatch,
    })
    userId = u.id
  } else if (emailRaw) {
    const byEmail = await prisma.user.findUnique({ where: { email: emailRaw } })
    if (byEmail) {
      if (byEmail.accountStatus === 'suspended' || byEmail.accountStatus === 'withdrawn') {
        return jsonError(403, '이용이 제한된 계정입니다.')
      }
      await prisma.account.create({
        data: {
          userId: byEmail.id,
          type: 'oauth',
          provider: 'naver',
          providerAccountId: naverId,
          ...tokenPatch,
        },
      })
      await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          lastLoginAt: new Date(),
          socialProvider: 'naver',
          socialProviderUserId: naverId,
          ...(name && !byEmail.name ? { name } : {}),
          ...(image && !byEmail.image ? { image } : {}),
          ...(!byEmail.signupMethod?.trim() ? { signupMethod: 'naver' } : {}),
        },
      })
      userId = byEmail.id
    } else {
      const role = bootstrapRoleForNewUserEmail(emailRaw)
      const created = await prisma.user.create({
        data: {
          name,
          email: emailRaw,
          image,
          signupMethod: 'naver',
          socialProvider: 'naver',
          socialProviderUserId: naverId,
          lastLoginAt: new Date(),
          ...(role ? { role } : {}),
          accounts: {
            create: {
              type: 'oauth',
              provider: 'naver',
              providerAccountId: naverId,
              ...tokenPatch,
            },
          },
        },
      })
      userId = created.id
    }
  } else {
    const created = await prisma.user.create({
      data: {
        name,
        email: null,
        image,
        signupMethod: 'naver',
        socialProvider: 'naver',
        socialProviderUserId: naverId,
        lastLoginAt: new Date(),
        accounts: {
          create: {
            type: 'oauth',
            provider: 'naver',
            providerAccountId: naverId,
            ...tokenPatch,
          },
        },
      },
    })
    userId = created.id
  }

  const full = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, role: true, accountStatus: true },
  })
  if (!full) {
    return jsonError(500, '회원 정보를 불러오지 못했습니다.')
  }
  if (full.accountStatus === 'suspended' || full.accountStatus === 'withdrawn') {
    return jsonError(403, '이용이 제한된 계정입니다.')
  }

  const target = redirectAfterNaverLogin(request, redirectPath)
  const res = NextResponse.redirect(target)
  res.cookies.delete(STATE_COOKIE)
  res.cookies.delete(REDIRECT_COOKIE)

  const sessionOk = await appendNaverSessionCookie({
    request,
    response: res,
    user: {
      id: full.id,
      name: full.name,
      email: full.email,
      image: full.image,
      role: full.role,
      accountStatus: full.accountStatus ?? 'active',
    },
  })
  if (!sessionOk) {
    return jsonError(500, '세션을 생성하지 못했습니다.')
  }

  return res
}
