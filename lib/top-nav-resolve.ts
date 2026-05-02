/**
 * 상단 메가메뉴 URL ↔ 목적지 매칭용 terms.
 * 권역·슬러그는 `lib/unified-location-tree` + `lib/location-url-slugs` 와 동일 규칙.
 */
import type { MegaMenuLeaf, MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
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
  params.set('country', countrySlugFromLabel(opts.countryLabel))
  params.set('city', citySlugFromLeaf(opts.leaf))
  return `${browseBasePath(scope)}?${params.toString()}`
}

export function buildProductsHrefCountryOnly(opts: {
  type: string
  regionId: string
  countryLabel: string
  scope?: BrowseHrefScope
}): string {
  const params = new URLSearchParams()
  appendBrowseTypeParamIfNarrowing(params, opts.type)
  const scope = opts.scope ?? 'overseas'
  if (scope === 'overseas') params.set('scope', 'overseas')
  else params.set('scope', 'domestic')
  params.set('region', opts.regionId)
  params.set('country', countrySlugFromLabel(opts.countryLabel))
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
  const group = reg.countryGroups.find((g) => countrySlugFromLabel(g.countryLabel) === country)
  if (!group) return []
  if (!city) {
    return group.cities.flatMap((c) => c.terms)
  }
  const leaf = group.cities.find((c) => citySlugFromTermsAndLabel(c.label, c.terms) === city)
  return leaf ? [...leaf.terms] : []
}
