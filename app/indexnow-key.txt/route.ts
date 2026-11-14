import { INDEXNOW_PUBLIC_KEY } from '@/lib/seo/indexnow'

/**
 * IndexNow 키 파일(keyLocation 보조). 본문은 저장소 공개 키와 같다. `public/<key>.txt` 가 정식 keyLocation.
 * REGRESSION-FREEZE[seo-indexnow-skip-on-failure]: 키 문자열만, 본문 없음 — manifest
 */
export const dynamic = 'force-static'

export function GET() {
  return new Response(INDEXNOW_PUBLIC_KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
