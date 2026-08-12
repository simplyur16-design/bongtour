/**
 * 해외 허브 히어로 — 클라이언트·서버 공용 타입·매칭(Prisma/Gemini 미사용).
 * REGRESSION-FREEZE[overseas-hub-season-hero-empty-poison]: normalizeOverseasHubSeasonHeroSlides — manifest
 */
import {
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
} from '@/lib/browse-country-url-resolve'

export type OverseasHubDestinationHeroSlide = {
  id: string
  cityKey: string
  countryKey: string | null
  countryKoreanLabel: string | null
  imageUrl: string | null
  headline: string
  subline: string
  href: string
  /** 서울 기준 헤드라인 대상 월(1–12), +1·+2·+3 */
  targetMonth1To12: number
}

/** 클라이언트 복구 API·SSR props 공통 — 깨진 payload가 히어로를 비우지 않게. */
export function normalizeOverseasHubSeasonHeroSlides(
  input: unknown,
): OverseasHubDestinationHeroSlide[] {
  if (!Array.isArray(input)) return []
  const out: OverseasHubDestinationHeroSlide[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const cityKey = typeof row.cityKey === 'string' ? row.cityKey.trim() : ''
    const headline = typeof row.headline === 'string' ? row.headline.trim() : ''
    const href = typeof row.href === 'string' ? row.href.trim() : ''
    const imageUrl =
      typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : null
    if (!id || !cityKey) continue
    if (!headline && !imageUrl) continue
    const monthRaw = Number(row.targetMonth1To12)
    const targetMonth1To12 =
      Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? Math.trunc(monthRaw) : 1
    out.push({
      id,
      cityKey,
      countryKey:
        typeof row.countryKey === 'string' && row.countryKey.trim() ? row.countryKey.trim() : null,
      countryKoreanLabel:
        typeof row.countryKoreanLabel === 'string' && row.countryKoreanLabel.trim()
          ? row.countryKoreanLabel.trim()
          : null,
      imageUrl,
      headline,
      subline: typeof row.subline === 'string' ? row.subline.trim() : '',
      href: href || `/travel/overseas?destination=${encodeURIComponent(cityKey)}`,
      targetMonth1To12,
    })
  }
  return out
}

export function findSeasonDestinationSlideForBrowseCountry(
  slides: OverseasHubDestinationHeroSlide[] | null | undefined,
  countryParam: string,
): OverseasHubDestinationHeroSlide | null {
  const slug = countryParam.trim().toLowerCase()
  if (!slug || !slides?.length) return null
  const dbCountries = resolveBrowseCountryParamToDbCountries(countryParam)
  const slugKeys = resolveBrowseCountryParamToCountryKeySlugs(countryParam).map((k) => k.toLowerCase())

  for (const s of slides) {
    const ck = (s.countryKey ?? '').trim().toLowerCase()
    if (ck && (ck === slug || slugKeys.includes(ck))) return s
    const ko = (s.countryKoreanLabel ?? '').trim()
    if (ko && dbCountries.includes(ko)) return s
  }
  return null
}
