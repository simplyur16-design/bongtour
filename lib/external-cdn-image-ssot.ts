/**
 * Memory #5 — 공개 이미지 URL SSOT: NCloud Object Storage만 허용.
 * 외부 CDN(Pexels·Unsplash·flagcdn·pixabay 등) 및 기타 http(s) 원격 URL은 재호스팅 대상.
 *
 * 클라이언트 번들 안전 — `object-storage` / sharp 미import.
 */
/** 운영·스크립트에서 명시적으로 인지하는 외부 CDN 호스트 */
export const EXTERNAL_CDN_HOST_SUFFIXES = [
  'images.pexels.com',
  'www.pexels.com',
  'pexels.com',
  'images.unsplash.com',
  'unsplash.com',
  'flagcdn.com',
  'cdn.pixabay.com',
  'pixabay.com',
] as const

export function normalizeImageUrlForPolicy(url: string): string {
  return url.trim().split('?')[0] ?? ''
}

export function isOurNcloudImageUrl(url: string): boolean {
  const t = (url ?? '').trim()
  if (!t || !/^https?:\/\//i.test(t)) return false
  try {
    const h = new URL(t).hostname.toLowerCase()
    return h.endsWith('.ncloudstorage.com') || h.endsWith('.ncloud.com')
  } catch {
    return false
  }
}

export function isLocalOrRelativeImageUrl(url: string): boolean {
  const t = (url ?? '').trim()
  if (!t) return true
  if (t.startsWith('/') || t.startsWith('data:')) return true
  return false
}

export function hostIsKnownExternalCdn(hostname: string): boolean {
  const h = hostname.toLowerCase()
  for (const suffix of EXTERNAL_CDN_HOST_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return true
  }
  return false
}

/** http(s) 이미지 URL이 NCloud·로컬이 아니면 외부(재호스팅·저장 차단 대상) */
export function isExternalCdnImageUrl(url: string): boolean {
  const t = (url ?? '').trim()
  if (!t || isLocalOrRelativeImageUrl(t)) return false
  if (!/^https?:\/\//i.test(t)) return false
  if (isOurNcloudImageUrl(t)) return false
  return true
}

export function externalCdnHostFromUrl(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase()
  } catch {
    return null
  }
}
