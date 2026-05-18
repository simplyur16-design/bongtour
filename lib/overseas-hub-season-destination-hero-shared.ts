/**
 * 해외 허브 히어로 — 클라이언트·서버 공용 타입·매칭(Prisma/Gemini 미사용).
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
