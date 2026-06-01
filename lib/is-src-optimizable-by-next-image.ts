import type { ImageProps } from 'next/image'

/**
 * `next.config.js` `images.remotePatterns`와 정합 — 여기서 true면 `next/image` 최적화 파이프라인 사용 가능.
 */
export function isSrcOptimizableByNextImage(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return true
  const t = src.trim()
  if (t.startsWith('/')) return true
  if (t.startsWith('data:')) return false
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'picsum.photos') return true
    if (host === 'images.unsplash.com') return true
    /**
     * 임시 안전망: Pexels CDN URL은 next/image 프록시를 거치면 Railway(Singapore)에서 Pexels로 fetch + Sharp 변환 비용이 누적되어 페이지 응답 1~2초 지연.
     * schedule batch rehost(scripts/rehost-schedule-pexels-batch.ts)로 NCloud로 옮기는 작업 진행 중.
     * rehost 완료 후에도 신규 등록 이미지의 일시적 Pexels CDN URL을 next/image 비용으로부터 보호하기 위해 false 유지.
     */
    if (host === 'images.pexels.com') return false
    /** 외부 CDN. next/image 프록시 비용(Railway↔외부 fetch+Sharp 변환) 회피. 장기: 국기 NCloud 이전 별도 트랙. */
    if (host === 'flagcdn.com' || host.endsWith('.flagcdn.com')) return false
    /** Ncloud 객체 URL — `SafeImage`에서 `<img>` 직접 로드(Railway `/_next/image` 프록시 미경유). */
    if (host.endsWith('.ncloudstorage.com') || host.endsWith('.ncloud.com')) return false
    if (host.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1')) return true
    return false
  } catch {
    return false
  }
}
