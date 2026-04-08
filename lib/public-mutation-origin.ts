import { NextResponse } from 'next/server'

/**
 * 공개 POST API(예약·문의·가입·후기)용 출처 검증.
 * NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL / VERCEL_URL 기준 origin 허용 목록과
 * 요청의 Origin·Referer origin을 비교한다.
 *
 * 프로덕션: 운영 접속 도메인(https://www.bongtour.com)을 항상 허용 목록에 포함해
 * env 누락·오설정 시에도 동일 사이트 정상 요청이 503/403으로 막히지 않게 한다.
 */

/** 운영 고객 접속 canonical origin — lib/link-builder·sitemap 등과 정합 */
const PRODUCTION_PUBLIC_ORIGIN = 'https://www.bongtour.com'

function normalizeOriginList(): string[] {
  const raw: (string | null | undefined)[] = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : null,
  ]
  const out = new Set<string>()
  if (process.env.NODE_ENV === 'production') {
    try {
      out.add(new URL(PRODUCTION_PUBLIC_ORIGIN).origin)
    } catch {
      /* skip */
    }
  }
  for (const r of raw) {
    const t = r?.trim()
    if (!t) continue
    try {
      const u = new URL(t.startsWith('http') ? t : `https://${t}`)
      out.add(u.origin)
    } catch {
      /* skip */
    }
  }
  return [...out]
}

function requestCandidateOrigins(request: Request): string[] {
  const out: string[] = []
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  if (origin) {
    try {
      out.push(new URL(origin).origin)
    } catch {
      /* */
    }
  }
  if (referer) {
    try {
      out.push(new URL(referer).origin)
    } catch {
      /* */
    }
  }
  return [...new Set(out)]
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  } catch {
    return false
  }
}

export type PublicMutationOriginError = { status: number; message: string }

/**
 * @returns null 이면 통과. 아니면 status·message 로 응답 생성.
 */
export function getPublicMutationOriginError(request: Request): PublicMutationOriginError | null {
  const allowed = normalizeOriginList()
  const candidates = requestCandidateOrigins(request)
  const isProd = process.env.NODE_ENV === 'production'

  if (candidates.length === 0) {
    if (!isProd) return null
    return { status: 403, message: '허용되지 않은 요청입니다. (Origin/Referer 없음)' }
  }

  if (allowed.length === 0) {
    if (!isProd) {
      if (candidates.every((c) => isLocalhostOrigin(c))) return null
      return { status: 403, message: '허용되지 않은 요청 출처입니다.' }
    }
    return {
      status: 503,
      message: '서버에 NEXT_PUBLIC_SITE_URL 또는 NEXT_PUBLIC_APP_URL 설정이 필요합니다.',
    }
  }

  const ok = candidates.some((c) => allowed.includes(c))
  if (ok) return null
  return { status: 403, message: '허용되지 않은 요청 출처입니다.' }
}

export function publicMutationOriginJsonResponse(err: PublicMutationOriginError): NextResponse {
  return NextResponse.json({ error: err.message }, { status: err.status })
}
