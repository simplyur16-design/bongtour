/**
 * 정식(canonical) 경로 유틸 — 쿼리·해시·중복 슬래시·끝 슬래시를 제거한 파라미터 없는 주소.
 * REGRESSION-FREEZE[seo-canonical-param-free]: canonical·og:url 은 utm·정렬·필터·페이지 파라미터 없는 정식 경로 — manifest
 */

/** 상대 경로 또는 절대 URL → 파라미터 없는 경로(`/a/b`). 홈은 `/`. 해석 불가면 null */
export function toCanonicalPath(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  let path = raw
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('//')) {
    try {
      path = new URL(raw.startsWith('//') ? `https:${raw}` : raw).pathname
    } catch {
      return null
    }
  }
  path = path.split('#')[0]!.split('?')[0]!
  if (!path.startsWith('/')) return null
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path || '/'
}

/** 절대 정식 주소(`https://origin/path`). 홈은 끝 슬래시 포함 */
export function toCanonicalUrl(input: string | null | undefined, origin: string): string | null {
  const p = toCanonicalPath(input)
  if (!p) return null
  const base = origin.replace(/\/+$/, '')
  return p === '/' ? `${base}/` : `${base}${p}`
}
