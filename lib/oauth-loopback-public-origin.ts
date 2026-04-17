/**
 * 브라우저가 localhost / 127.0.0.1 로 접속한 OAuth 시작·콜백에서,
 * NEXTAUTH_URL 등이 운영(bongtour.com)으로만 잡혀 있어도 redirect_uri 가 로컬로 맞게 나가도록 한다.
 *
 * loopback 은 항상 http:// 로 고정한다. (nginx 등이 x-forwarded-proto=https 를 잘못 넘기면
 * https://localhost:3000 이 되어 카카오 KOE006·미등록 redirect_uri 로 거절됨)
 *
 * Host 가 bongtour.com 등 공개 도메인이면 request.url 을 보지 않는다. (프록시 뒤에서
 * request.url 이 http://localhost:3000 / 127.0.0.1 로 잡혀 redirect_uri 가 로컬로 나가는 KOE006 방지)
 */

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '')
}

/** Host 또는 request.url 이 loopback 이면 공개 origin(포트 포함). 아니면 null. */
export function publicOriginIfLoopbackRequest(request: Request): string | null {
  const hostHeader = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim()
  if (hostHeader) {
    const hostNoPort = hostHeader.replace(/:\d+$/, '')
    if (hostNoPort === 'localhost' || hostNoPort === '127.0.0.1') {
      return stripTrailingSlash(`http://${hostHeader}`)
    }
    return null
  }
  try {
    const u = new URL(request.url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return stripTrailingSlash(`http://${u.host}`)
    }
  } catch {
    /* ignore */
  }
  return null
}
