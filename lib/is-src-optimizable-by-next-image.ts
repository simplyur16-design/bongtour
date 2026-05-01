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
    if (host === 'images.pexels.com') return true
    if (host === 'flagcdn.com' || host.endsWith('.flagcdn.com')) return true
    /** Ncloud 객체 URL — `SafeImage`에서 `<img>` 직접 로드(Railway `/_next/image` 프록시 미경유). */
    if (host.endsWith('.ncloudstorage.com') || host.endsWith('.ncloud.com')) return false
    if (host.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1')) return true
    return false
  } catch {
    return false
  }
}
