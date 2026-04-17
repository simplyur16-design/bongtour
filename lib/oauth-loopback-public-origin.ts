/**
 * 브라우저가 localhost / 127.0.0.1 로 접속한 OAuth 시작·콜백에서,
 * NEXTAUTH_URL 등이 운영(bongtour.com)으로만 잡혀 있어도 redirect_uri 가 로컬로 맞게 나가도록 한다.
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
      const fp = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
      const proto = fp === 'https' || fp === 'http' ? fp : 'http'
      return stripTrailingSlash(`${proto}://${hostHeader}`)
    }
  }
  try {
    const u = new URL(request.url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return stripTrailingSlash(u.origin)
    }
  } catch {
    /* ignore */
  }
  return null
}
