/**
 * Pexels 검색 키워드 빌더.
 *
 * 카드뉴스 슬라이드의 비주얼은 Gemini 가 1차로 pexelsKeyword 를 생성하지만,
 * 누락·빈 값일 때 보조(fallback)로 도시/명소 + 시즌 + 분위기를 조합해 키워드를 만든다.
 */

const SEASON_KEYWORDS: Record<string, string[]> = {
  spring: ['spring', 'cherry blossom'],
  summer: ['summer', 'tropical'],
  autumn: ['autumn', 'fall foliage'],
  winter: ['winter', 'snow'],
  all_year: [],
}

/** @deprecated departureMonth 기반 — 레거시 호환용 */
const SEASON_KEYWORDS_BY_MONTH: Record<number, string[]> = {
  1: ['winter', 'cold season'],
  2: ['winter', 'late winter'],
  3: ['spring', 'cherry blossom'],
  4: ['spring', 'mild weather'],
  5: ['late spring', 'green season'],
  6: ['early summer', 'rainy season'],
  7: ['summer', 'monsoon', 'tropical'],
  8: ['summer', 'tropical', 'dry season'],
  9: ['autumn', 'early autumn'],
  10: ['autumn', 'fall foliage'],
  11: ['late autumn', 'cool season'],
  12: ['winter', 'christmas season'],
}

/** 시리즈 season → Pexels 계절 키워드 (all_year·null 은 빈 배열) */
export function seasonKeywordsForSeason(season: string | null | undefined): string[] {
  if (!season || season === 'all_year') return []
  return SEASON_KEYWORDS[season] ?? []
}

/** 해당 월의 대표 계절 키워드 배열(없으면 빈 배열) — 레거시 */
export function seasonKeywordsForMonth(month: number): string[] {
  return SEASON_KEYWORDS_BY_MONTH[month] ?? []
}

/**
 * 도시/명소/시즌/분위기를 조합해 Pexels 검색 키워드를 만든다.
 *
 * @param city    도시명(필수, 비면 무시)
 * @param place   명소명(선택)
 * @param season  spring/summer/autumn/winter/all_year 또는 null
 * @param mode    분위기 — 'sunset', 'golden hour', 'daytime' 등 (선택)
 */
export function buildPexelsKeyword(
  city: string,
  place: string | null,
  season: string | null | undefined,
  mode?: string,
): string {
  const seasonWords = seasonKeywordsForSeason(season)
  const seasonWord = seasonWords[0] ?? ''

  const parts: string[] = []
  if (city && city.trim()) parts.push(city.trim())
  if (place && place.trim()) parts.push(place.trim())
  if (seasonWord) parts.push(seasonWord)
  if (mode && mode.trim()) parts.push(mode.trim())

  return parts.join(' ')
}
