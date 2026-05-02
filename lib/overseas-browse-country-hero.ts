import { resolveBrowseCountryParamToDbCountries } from '@/lib/browse-country-url-resolve'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'

export function findMonthlyCurationForBrowseCountrySlug(
  curations: HomeSeasonPickDTO[] | null | undefined,
  countryParam: string
): HomeSeasonPickDTO | null {
  const slug = countryParam.trim().toLowerCase()
  if (!slug || !curations?.length) return null
  const dbCountries = resolveBrowseCountryParamToDbCountries(countryParam)
  for (const c of curations) {
    const ccRaw = (c.relatedCountryCode ?? '').trim()
    if (ccRaw) {
      if (dbCountries.includes(ccRaw)) return c
      const ccLower = ccRaw.toLowerCase()
      if (/^[a-z0-9-]+$/.test(ccLower) && ccLower === slug) return c
    }
    const rs = (c.resolvedProductCountrySlug ?? '').trim().toLowerCase()
    if (rs && rs === slug) return c
  }
  return null
}

/** browse `country` 쿼리 → 표시용 한글 나라명(첫 DB 값 또는 슬러그 역조회) */
export function countryDisplayNameFromBrowseParam(countryParam: string): string {
  const p = countryParam.trim()
  if (!p) return ''
  const db = resolveBrowseCountryParamToDbCountries(p)
  if (db[0]) return db[0]
  return koreanCountryLabelFromBrowseSlug(p.toLowerCase()) ?? p
}
