import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { bootstrapRoleForNewUserEmail } from '@/lib/bootstrap-user-role'
import {
  KAKAO_OAUTH_REDIRECT_COOKIE,
  KAKAO_OAUTH_STATE_COOKIE,
  clearKakaoOAuthStateCookies,
  kakaoOAuthLog,
  maskKakaoClientId,
  maskKakaoState,
  resolveKakaoOAuthPublicOrigin,
  resolveKakaoRedirectUri,
} from '@/lib/kakao-oauth-public'
import type { KakaoTokenResponse, KakaoUserMeResponse } from '@/lib/kakao-oauth-types'
import { appendNaverSessionCookie, redirectAfterNaverLogin } from '@/lib/naver-auth-session'
import { readCookieFromRequestHeader } from '@/lib/parse-cookie-header'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const PROFILE_URL = 'https://kapi.kakao.com/v2/user/me'

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, ...(detail !== undefined ? { detail } : {}) },
    { status }
  )
}

function jsonErrorClearState(request: Request, status: number, error: string, detail?: string) {
  const res = jsonError(status, error, detail)
  clearKakaoOAuthStateCookies(res, request)
  return res
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

function expiresAtFromToken(t: KakaoTokenResponse): number | null {
  const raw = t.expires_in
  if (raw === undefined || raw === null) return null
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.floor(Date.now() / 1000) + n
}

export async function GET(request: Request) {
  const publicOrigin = resolveKakaoOAuthPublicOrigin(request)
  const redirectUri = resolveKakaoRedirectUri(request)

  const { searchParams } = new URL(request.url)
  const oauthErr = searchParams.get('error')
  const oauthErrDesc = searchParams.get('error_description')
  if (oauthErr) {
    return jsonErrorClearState(request, 400, '카카오 인증 오류', oauthErrDesc ?? oauthErr)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!state) {
    return jsonErrorClearState(request, 400, 'state 파라미터가 없습니다.')
  }

  const cookieStore = cookies()
  const savedState =
    cookieStore.get(KAKAO_OAUTH_STATE_COOKIE)?.value ??
    readCookieFromRequestHeader(request, KAKAO_OAUTH_STATE_COOKIE)

  kakaoOAuthLog('callback:begin', {
    nodeEnv: process.env.NODE_ENV,
    requestHost: request.headers.get('host'),
    publicOrigin,
    redirectUri,
    queryState: maskKakaoState(state),
    storedStatePresent: Boolean(savedState),
  })

  if (!savedState || !safeStateEqual(savedState, state)) {
    console.warn('[kakao-oauth] state mismatch', {
      nodeEnv: process.env.NODE_ENV,
      requestHost: request.headers.get('host'),
      publicOrigin,
      redirectUri,
      queryState: maskKakaoState(state),
      storedPresent: Boolean(savedState),
      storedState: maskKakaoState(savedState),
    })
    return jsonErrorClearState(
      request,
      400,
      'state가 일치하지 않습니다.',
      '로그인 시작과 동일한 공개 URL에서 콜백이 열렸는지 확인하세요. NEXTAUTH_URL·KAKAO_OAUTH_PUBLIC_ORIGIN·KAKAO_CALLBACK_URL(선택)이 실제 접속 도메인과 일치해야 합니다.'
    )
  }

  if (!code) {
    return jsonErrorClearState(request, 400, 'code 파라미터가 없습니다.')
  }

  const redirectPath = safeRedirectPath(
    cookieStore.get(KAKAO_OAUTH_REDIRECT_COOKIE)?.value ??
      readCookieFromRequestHeader(request, KAKAO_OAUTH_REDIRECT_COOKIE)
  )

  const clientId = process.env.KAKAO_CLIENT_ID?.trim()
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return jsonErrorClearState(request, 500, '카카오 OAuth 환경 변수가 누락되었습니다.')
  }

  kakaoOAuthLog('callback:after-state', {
    hasCode: true,
    clientId: maskKakaoClientId(clientId),
    redirectPath,
  })

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  })

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: tokenBody.toString(),
    cache: 'no-store',
  })

  const tokenJson = (await tokenRes.json()) as KakaoTokenResponse
  kakaoOAuthLog('callback:token', {
    ok: tokenRes.ok && !tokenJson.error,
    status: tokenRes.status,
    error: tokenJson.error ? String(tokenJson.error) : undefined,
  })

  if (!tokenRes.ok || tokenJson.error) {
    return jsonErrorClearState(
      request,
      400,
      '액세스 토큰 발급에 실패했습니다.',
      tokenJson.error_description ?? tokenJson.error ?? tokenRes.statusText
    )
  }

  const accessToken = tokenJson.access_token?.trim()
  if (!accessToken) {
    return jsonErrorClearState(request, 400, '액세스 토큰 응답에 access_token이 없습니다.')
  }

  const profileRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const profileJson = (await profileRes.json()) as KakaoUserMeResponse
  kakaoOAuthLog('callback:profile', {
    ok: profileRes.ok && Number.isFinite(profileJson.id),
    status: profileRes.status,
  })

  if (!profileRes.ok || !Number.isFinite(profileJson.id)) {
    return jsonErrorClearState(request, 400, '프로필 조회에 실패했습니다.', profileRes.statusText)
  }

  const kakaoId = String(profileJson.id)
  const emailRaw = profileJson.kakao_account?.email?.trim().toLowerCase()
  const name =
    profileJson.kakao_account?.profile?.nickname?.trim() ||
    (emailRaw ? emailRaw.split('@')[0] : null) ||
    null
  const image = profileJson.kakao_account?.profile?.profile_image_url?.trim() || null

  const tokenPatch = {
    access_token: tokenJson.access_token ?? null,
    refresh_token: tokenJson.refresh_token ?? null,
    expires_at: expiresAtFromToken(tokenJson),
    token_type: tokenJson.token_type ?? null,
  }

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'kakao', providerAccountId: kakaoId } },
    include: { user: true },
  })

  let userId: string

  if (linked) {
    const u = linked.user
    if (u.accountStatus === 'suspended' || u.accountStatus === 'withdrawn') {
      return jsonErrorClearState(request, 403, '이용이 제한된 계정입니다.')
    }
    await prisma.user.update({
      where: { id: u.id },
      data: {
        lastLoginAt: new Date(),
        socialProvider: 'kakao',
        socialProviderUserId: kakaoId,
        ...(name && !u.name ? { name } : {}),
        ...(image && !u.image ? { image } : {}),
        ...(emailRaw && !u.email ? { email: emailRaw } : {}),
        ...(!u.signupMethod?.trim() ? { signupMethod: 'kakao' } : {}),
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
        return jsonErrorClearState(request, 403, '이용이 제한된 계정입니다.')
      }
      await prisma.account.create({
        data: {
          userId: byEmail.id,
          type: 'oauth',
          provider: 'kakao',
          providerAccountId: kakaoId,
          ...tokenPatch,
        },
      })
      await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          lastLoginAt: new Date(),
          socialProvider: 'kakao',
          socialProviderUserId: kakaoId,
          ...(name && !byEmail.name ? { name } : {}),
          ...(image && !byEmail.image ? { image } : {}),
          ...(!byEmail.signupMethod?.trim() ? { signupMethod: 'kakao' } : {}),
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
          signupMethod: 'kakao',
          socialProvider: 'kakao',
          socialProviderUserId: kakaoId,
          lastLoginAt: new Date(),
          ...(role ? { role } : {}),
          accounts: {
            create: {
              type: 'oauth',
              provider: 'kakao',
              providerAccountId: kakaoId,
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
        signupMethod: 'kakao',
        socialProvider: 'kakao',
        socialProviderUserId: kakaoId,
        lastLoginAt: new Date(),
        accounts: {
          create: {
            type: 'oauth',
            provider: 'kakao',
            providerAccountId: kakaoId,
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
    return jsonErrorClearState(request, 500, '회원 정보를 불러오지 못했습니다.')
  }
  if (full.accountStatus === 'suspended' || full.accountStatus === 'withdrawn') {
    return jsonErrorClearState(request, 403, '이용이 제한된 계정입니다.')
  }

  const target = redirectAfterNaverLogin(request, redirectPath)
  const res = NextResponse.redirect(target)
  clearKakaoOAuthStateCookies(res, request)

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
    kakaoOAuthLog('callback:session', { ok: false })
    return jsonErrorClearState(request, 500, '세션을 생성하지 못했습니다.')
  }

  kakaoOAuthLog('callback:success', { userId: full.id })
  return res
}
