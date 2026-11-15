/**
 * Unsplash 사진 크레딧 SSOT (사장님 10/25 사진 원칙 + 10/30 Unsplash ① 결정).
 * - 크레딧이 필요한 사진은 최소로: Pexels가 먼저, Unsplash는 Pexels에 맞는 사진이 없을 때만.
 * - Unsplash 사진에만 아주 작은 글씨 'Photo: [작가] / Unsplash' + 작가 프로필 링크 + Unsplash 링크(utm_source=bongtour&utm_medium=referral).
 * - Pexels·자체 사진·CC0·기존 iStock은 크레딧 없음(이 함수가 null).
 * 저장 칸(새 칸 없음, 기존 Product 칸):
 *   bgImagePhotographer = 작가 이름(user.name), bgImageSourceUrl = 작가 프로필 주소(user.links.html, https://unsplash.com/@아이디),
 *   bgImageExternalId = Unsplash 사진 ID(사진 페이지는 https://unsplash.com/photos/<ID> 로 복원 가능).
 * REGRESSION-FREEZE[unsplash-credit-1030]: Unsplash에만 작은 크레딧·작가 프로필+Unsplash 링크 utm·Pexels/자체/CC0/iStock 크레딧 없음 — manifest
 */
import { canonicalProductImageSourceKey } from '@/lib/product-image-source-attribution'

export const UNSPLASH_UTM_QUERY = 'utm_source=bongtour&utm_medium=referral'
export const UNSPLASH_HOME_URL = 'https://unsplash.com/'

/** 작가 프로필 주소인지 — https://unsplash.com/@아이디 만 */
export function isUnsplashProfileUrl(url: string | null | undefined): boolean {
  try {
    const u = new URL(String(url ?? '').trim())
    return u.protocol === 'https:' && (u.hostname === 'unsplash.com' || u.hostname === 'www.unsplash.com') && /^\/@[^/]+\/?$/.test(u.pathname)
  } catch {
    return false
  }
}

/** utm 붙이기(기존 utm 값은 bongtour/referral 로 교체) */
export function withUnsplashUtm(url: string): string {
  const u = new URL(url)
  u.searchParams.set('utm_source', 'bongtour')
  u.searchParams.set('utm_medium', 'referral')
  return u.toString()
}

export type UnsplashCredit = {
  authorName: string
  /** 작가 프로필 + utm */
  authorHref: string
  /** Unsplash 홈 + utm */
  unsplashHref: string
  /** 화면 문구 그대로 */
  text: string
}

/**
 * 대표 사진이 Unsplash일 때만 크레딧을 돌려줌. 작가 이름·프로필 주소가 없으면 null(정책에서 그런 사진은 통과 못 함).
 * displayedUrl 을 주면 그 주소가 대표 사진(bgImageUrl)과 같을 때만(일정 사진 등 대체 표시에는 붙이지 않음).
 */
export function resolveUnsplashCredit(params: {
  source?: string | null
  photographer?: string | null
  profileUrl?: string | null
  imageUrl?: string | null
  displayedUrl?: string | null
}): UnsplashCredit | null {
  const img = String(params.imageUrl ?? '').trim()
  if (params.displayedUrl !== undefined) {
    const shown = String(params.displayedUrl ?? '').trim()
    if (!img || shown !== img) return null
  }
  const key = canonicalProductImageSourceKey(params.source ?? null, { imageUrl: img || null })
  let hot = false
  try {
    hot = !!img && new URL(img).hostname === 'images.unsplash.com'
  } catch {
    hot = false
  }
  if (key !== 'unsplash' && !hot) return null
  const name = String(params.photographer ?? '').trim()
  const profile = String(params.profileUrl ?? '').trim()
  if (!name || !isUnsplashProfileUrl(profile)) return null
  return {
    authorName: name,
    authorHref: withUnsplashUtm(profile),
    unsplashHref: withUnsplashUtm(UNSPLASH_HOME_URL),
    text: `Photo: ${name} / Unsplash`,
  }
}

/** 검수 파일(CSV/JSON)용 크레딧 문구 — Unsplash 줄만, 나머지는 빈 값 */
export function unsplashCreditReviewText(p: { source: string; authorName?: string | null; authorProfileUrl?: string | null }): string {
  if (p.source !== 'unsplash') return ''
  const c = resolveUnsplashCredit({ source: 'unsplash', photographer: p.authorName, profileUrl: p.authorProfileUrl })
  return c ? `${c.text} (${c.authorHref})` : 'MISSING_CREDIT'
}
