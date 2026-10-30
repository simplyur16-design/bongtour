/**
 * Unsplash 검색 연동 (사장님 2026-10-30 19:34 KST "Unsplash 연결해"). 서버 전용.
 * - 키: 환경변수 UNSPLASH_ACCESS_KEY (Access Key, 'Authorization: Client-ID <key>'). 없으면 깔끔히 꺼짐(빈 결과, 네트워크 없음).
 * - 키는 절대 로그·응답·에러 문구에 넣지 않음.
 * - Unsplash API 가이드라인: (1) API가 준 photo.urls 주소를 그대로 씀(핫링크, 재호스팅 안 함)
 *   (2) 사진을 실제로 고를 때 photo.links.download_location 으로 요청(triggerUnsplashDownload).
 * - 출처 기록(작가·원본링크·ID)은 DB에 저장하지 않음(사장님 10/30 "출처를 따로쓰지 않아도 되는 사진은 괜찮다").
 *   ※ 가이드라인 3번(화면 표시 시 Unsplash·작가 표시+링크)은 사장님 결정 사항으로 보고됨 — 이 모듈은 저장하지 않음.
 * 순서: Pexels → Unsplash → AI (IMAGE_SOURCE_TIER_ORDER).
 * REGRESSION-FREEZE[product-image-stage4-1030]: env 없으면 꺼짐·키 로그 금지·핫링크·download_location — manifest
 */

export const UNSPLASH_ACCESS_KEY_ENV = 'UNSPLASH_ACCESS_KEY'
const API = 'https://api.unsplash.com'

export function getUnsplashAccessKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = (env[UNSPLASH_ACCESS_KEY_ENV] ?? '').trim()
  return k ? k : null
}

export function isUnsplashConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return getUnsplashAccessKey(env) != null
}

export type UnsplashHeroCandidate = {
  unsplashId: string
  /** 핫링크 주소(photo.urls.raw + 크기 파라미터) — 재호스팅하지 않음 */
  imageUrl: string
  width: number
  height: number
  /** 고를 때 호출할 주소(photo.links.download_location) — 저장용 아님 */
  downloadLocation: string
  queryUsed: string
  altText?: string
}

type UnsplashApiPhoto = {
  id?: string
  width?: number
  height?: number
  alt_description?: string | null
  urls?: { raw?: string; full?: string; regular?: string }
  links?: { download_location?: string }
}

type FetchLike = typeof fetch

/** 대표 사진 폭: 원본이 더 크면 2400px로 맞춤(Unsplash imgix 파라미터, 주소는 API가 준 raw 기반) */
export const UNSPLASH_HERO_TARGET_WIDTH = 2400

export function buildUnsplashHotlinkUrl(raw: string, width = UNSPLASH_HERO_TARGET_WIDTH): string {
  const u = new URL(raw)
  u.searchParams.set('w', String(width))
  u.searchParams.set('fm', 'jpg')
  u.searchParams.set('q', '80')
  u.searchParams.set('fit', 'max')
  return u.toString()
}

function headers(key: string): Record<string, string> {
  return { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }
}

function scrub(msg: string, key: string | null): string {
  let m = msg
  if (key) m = m.split(key).join('[redacted]')
  return m.replace(/Client-ID\s+\S+/gi, 'Client-ID [redacted]')
}

/** 가로 사진 검색. 키 없음·오류 → []. 키는 로그에 남기지 않음. */
export async function searchUnsplashHeroCandidates(
  keyword: string,
  perPage: number,
  queryUsed: string,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike } = {}
): Promise<UnsplashHeroCandidate[]> {
  const key = getUnsplashAccessKey(deps.env ?? process.env)
  if (!key) return []
  const query = keyword.trim()
  if (!query) return []
  const f = deps.fetchImpl ?? fetch
  const take = Math.min(Math.max(perPage, 1), 30)
  const url = `${API}/search/photos?query=${encodeURIComponent(query)}&per_page=${take}&orientation=landscape&content_filter=high`
  try {
    const res = await f(url, { headers: headers(key) })
    if (!res.ok) {
      console.warn(`[unsplash] search HTTP ${res.status}`)
      return []
    }
    const j = (await res.json()) as { results?: UnsplashApiPhoto[] }
    const out: UnsplashHeroCandidate[] = []
    for (const p of j.results ?? []) {
      const raw = p.urls?.raw?.trim()
      const dl = p.links?.download_location?.trim()
      if (!p.id || !raw || !dl) continue
      const w0 = typeof p.width === 'number' ? p.width : 0
      const h0 = typeof p.height === 'number' ? p.height : 0
      const w = w0 > UNSPLASH_HERO_TARGET_WIDTH ? UNSPLASH_HERO_TARGET_WIDTH : w0
      const h = w0 > 0 ? Math.round((h0 * w) / w0) : 0
      out.push({
        unsplashId: p.id,
        imageUrl: buildUnsplashHotlinkUrl(raw, w || UNSPLASH_HERO_TARGET_WIDTH),
        width: w,
        height: h,
        downloadLocation: dl,
        queryUsed,
        altText: p.alt_description ?? undefined,
      })
    }
    return out
  } catch (e) {
    console.warn('[unsplash] search error', scrub(e instanceof Error ? e.message : String(e), key))
    return []
  }
}

/** 가이드라인 2번: 사진을 고를 때(대표 사진으로 확정) download_location 호출. 성공 여부만 반환. */
export async function triggerUnsplashDownload(
  downloadLocation: string,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike } = {}
): Promise<boolean> {
  const key = getUnsplashAccessKey(deps.env ?? process.env)
  if (!key) return false
  let u: URL
  try {
    u = new URL(downloadLocation)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.hostname !== 'api.unsplash.com') return false
  const f = deps.fetchImpl ?? fetch
  try {
    const res = await f(u.toString(), { headers: headers(key) })
    return res.ok
  } catch (e) {
    console.warn('[unsplash] download_location error', scrub(e instanceof Error ? e.message : String(e), key))
    return false
  }
}

/** Unsplash 핫링크 주소인지 (재호스팅 금지 판단용) */
export function isUnsplashHotlinkUrl(url: string | null | undefined): boolean {
  try {
    return new URL(String(url ?? '')).hostname === 'images.unsplash.com'
  } catch {
    return false
  }
}
