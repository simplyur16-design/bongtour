import { countrySlugFromLabel } from '@/lib/location-url-slugs'

/** 제목/도시명 → `Product.country` browse 슬러그 (없으면 null) */
const TITLE_PLACE_TO_SLUG: Record<string, string> = {
  스페인: 'spain',
  스위스: 'switzerland',
  이탈리아: 'italy',
  프랑스: 'france',
  독일: 'germany',
  영국: 'uk',
  베트남: 'vietnam',
  다낭: 'vietnam',
  태국: 'thailand',
  일본: 'japan',
  홋카이도: 'japan',
  오사카: 'japan',
  도쿄: 'japan',
  괌: 'guam',
  하와이: 'hawaii',
}

/**
 * MonthlyCurationContent → 상품 `country` 슬러그 매칭.
 * `countryCode`가 있으면 소문자·한글 라벨 모두 허용, 없으면 `N월의 ○○` 제목에서 추출.
 */
export function resolveMonthlyCurationProductCountrySlug(
  countryCode: string | null | undefined,
  title: string,
): string | null {
  const cc = (countryCode ?? '').trim()
  if (cc) {
    const lower = cc.toLowerCase()
    if (/^[a-z0-9-]+$/.test(lower)) return lower
    const fromKr = countrySlugFromLabel(cc)
    return fromKr || null
  }

  const t = (title ?? '').trim()
  const m = t.match(/\d{1,2}월의\s*(.+)$/)
  const place = (m?.[1] ?? '').trim()
  if (!place) return null

  const direct = TITLE_PLACE_TO_SLUG[place]
  if (direct) return direct

  const slug = countrySlugFromLabel(place)
  return slug || null
}
