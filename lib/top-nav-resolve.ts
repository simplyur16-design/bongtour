/**
 * 상단 메가메뉴 URL ↔ 목적지 매칭용 terms.
 * 권역·슬러그는 `lib/unified-location-tree` + `lib/location-url-slugs` 와 동일 규칙.
 */
import type { MegaMenuCountryGroup, MegaMenuLeaf, MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
import { OVERSEAS_MEGA_MENU_REGIONS } from '@/lib/travel-landing-mega-menu-data'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

/** 메가메뉴에서 일반 권역만 (추천/자유/공급사 특수 탭 제외) */
export const TOP_NAV_MEGA_REGIONS: MegaMenuRegion[] = OVERSEAS_MEGA_MENU_REGIONS.filter(
  (r) => !r.special && r.countryGroups?.length,
)

export { countrySlugFromLabel }

export function citySlugFromLeaf(leaf: MegaMenuLeaf): string {
  return citySlugFromTermsAndLabel(leaf.label, leaf.terms)
}

/** 메가메뉴 기본 `travel` 은 URL에 넣지 않음 */
function appendBrowseTypeParamIfNarrowing(params: URLSearchParams, type: string): void {
  const u = type.trim().toLowerCase()
  if (u === '' || u === 'travel') return
  params.set('type', type.trim())
}

export type BrowseHrefScope = 'overseas' | 'domestic'

function browseBasePath(scope: BrowseHrefScope): string {
  return scope === 'domestic' ? '/travel/domestic' : '/travel/overseas'
}

export function buildProductsHref(opts: {
  type: string
  regionId: string
  countryLabel: string
  leaf: MegaMenuLeaf
  /** 기본 해외 허브 — 국내 전용 링크만 domestic */
  scope?: BrowseHrefScope
}): string {
  const params = new URLSearchParams()
  appendBrowseTypeParamIfNarrowing(params, opts.type)
  const scope = opts.scope ?? 'overseas'
  if (scope === 'overseas') params.set('scope', 'overseas')
  else params.set('scope', 'domestic')
  params.set('region', opts.regionId)
  const countrySlugSource = opts.leaf.browseCountryLabel ?? opts.countryLabel
  params.set('country', countrySlugFromLabel(countrySlugSource))
  params.set('city', citySlugFromLeaf(opts.leaf))
  return `${browseBasePath(scope)}?${params.toString()}`
}

export function buildProductsHrefCountryOnly(opts: {
  type: string
  regionId: string
  countryLabel: string
  /** 그룹 헤더와 browse country 슬러그가 다를 때 */
  headerBrowseCountryLabel?: string
  scope?: BrowseHrefScope
}): string {
  const params = new URLSearchParams()
  appendBrowseTypeParamIfNarrowing(params, opts.type)
  const scope = opts.scope ?? 'overseas'
  if (scope === 'overseas') params.set('scope', 'overseas')
  else params.set('scope', 'domestic')
  params.set('region', opts.regionId)
  params.set('country', countrySlugFromLabel(opts.headerBrowseCountryLabel ?? opts.countryLabel))
  return `${browseBasePath(scope)}?${params.toString()}`
}

/**
 * URL 쿼리(region/country/city)로부터 상품 목적지 매칭용 terms.
 * city가 없으면 해당 국가 블록의 모든 도시 terms를 합친다.
 */
export function destinationTermsFromQuery(region: string | null, country: string | null, city: string | null): string[] {
  if (!region || !country) return []
  const reg = TOP_NAV_MEGA_REGIONS.find((r) => r.id === region)
  if (!reg?.countryGroups) return []
  const countryNorm = country.trim().toLowerCase()

  for (const g of reg.countryGroups) {
    if (countrySlugFromLabel(g.countryLabel) === countryNorm) {
      if (!city) {
        const out = new Set<string>()
        for (const c of g.cities) c.terms.forEach((t) => out.add(t))
        return [...out]
      }
      const leaf = g.cities.find((c) => citySlugFromTermsAndLabel(c.label, c.terms) === city)
      return leaf ? [...leaf.terms] : []
    }
  }

  const matches: { g: MegaMenuCountryGroup; c: MegaMenuLeaf }[] = []
  for (const g of reg.countryGroups) {
    for (const c of g.cities) {
      const slug = countrySlugFromLabel(c.browseCountryLabel ?? g.countryLabel)
      if (slug === countryNorm) matches.push({ g, c })
    }
  }
  if (matches.length === 0) return []
  if (!city) {
    const out = new Set<string>()
    for (const { c } of matches) c.terms.forEach((t) => out.add(t))
    return [...out]
  }
  const hit = matches.find(({ c }) => citySlugFromTermsAndLabel(c.label, c.terms) === city)
  return hit ? [...hit.c.terms] : []
}
