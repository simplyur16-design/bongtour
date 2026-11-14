import { resolveIndexNowKey } from '@/lib/seo/indexnow'

/**
 * IndexNow 키 파일(keyLocation). `INDEXNOW_KEY` 가 없으면 404 — 알림도 SKIP 된다.
 * REGRESSION-FREEZE[seo-indexnow-skip-on-failure]: 키 없으면 404, 있으면 키 문자열만 — manifest
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const key = resolveIndexNowKey()
  if (!key) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
