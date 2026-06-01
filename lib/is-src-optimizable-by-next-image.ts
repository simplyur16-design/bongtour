import type { ImageProps } from 'next/image'
import { isExternalCdnImageUrl, isLocalOrRelativeImageUrl } from '@/lib/external-cdn-image-ssot'

/**
 * `next.config.js` `images.remotePatterns`와 정합 — 여기서 true면 `next/image` 최적화 파이프라인 사용 가능.
 * Memory #5: 외부 CDN·미등록 http(s) URL은 false — Railway `/_next/image` 프록시 비용 회피 + rehost 누락 안전망.
 */
export function isSrcOptimizableByNextImage(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return true
  const t = src.trim()
  if (isLocalOrRelativeImageUrl(t)) return true
  if (isExternalCdnImageUrl(t)) return false
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'picsum.photos') return true
    /** Ncloud 객체 URL — `SafeImage`에서 `<img>` 직접 로드 */
    if (host.endsWith('.ncloudstorage.com') || host.endsWith('.ncloud.com')) return false
    if (host.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1')) return true
    return false
  } catch {
    return false
  }
}
