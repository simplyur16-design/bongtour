/**
 * 상단 메가메뉴 URL ↔ 목적지 매칭용 terms.
 * 권역·슬러그는 `lib/unified-location-tree` + `lib/location-url-slugs` 와 동일 규칙.
 */
import type { MegaMenuCountryGroup, MegaMenuLeaf, MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
import { OVERSEAS_MEGA_MENU_REGIONS } from '@/lib/travel-landing-mega-menu-data'
import { appendMenuGroupParam } from '@/lib/mega-menu-browse-group'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

/** 메가메뉴에서 일반 권역(도시 펼침) + 지방출발 단일 링크 탭만 (추천/자유/공급사 특수 탭 제외) */
export const TOP_NAV_MEGA_REGIONS: MegaMenuRegion[] = OVERSEAS_MEGA_MENU_REGIONS.filter(
  (r) => !r.special && (r.countryGroups?.length || r.localDeparture),
)

export { countrySlugFromLabel }

export function citySlugFromLeaf(leaf: MegaMenuLeaf): string {
  return citySlugFromTermsAndLabel(leaf.label, leaf.terms)
}

/** city leaf URL `country` — 잘못 박힌 browseCountryLabel(도시명) 무시, 그룹·헤더 SSOT 우선 */
export function countrySlugForMegaMenuCityHref(opts: {
  leaf: MegaMenuLeaf
  countryLabel: string
  headerBrowseCountryLabel?: string
}): string {
  const explicit = opts.leaf.browseCountryLabel?.trim()
  if (explicit && explicit !== opts.leaf.label.trim()) {
    return countrySlugFromLabel(explicit)
  }
  const header = opts.headerBrowseCountryLabel?.trim()
  if (header) return countrySlugFromLabel(header)
  return countrySlugFromLabel(opts.countryLabel)
}

/** 메가메뉴 기본 `travel` 은 URL에 넣지 않음 */
function appendBrowseTypeParamIfNarrowing(params: URLSearchParams, type: string): void {
  const u = type.trim().toLowerCase()
  if (u === '' || u === 'travel') return
  params.set('type', type.trim())
}

export type BrowseHrefScope = 'overseas' | 'domestic'

function browseBasePath(scope: BrowseHrefScope): string {
  return '/travel/overseas'
}

export function buildProductsHref(opts: {
  type: string
  regionId: string
  countryLabel: string
  /** 일본·중국 현·도 그룹 — 도시·헤더 URL의 browse `country` SSOT */
  headerBrowseCountryLabel?: string
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
  params.set(
    'country',
    countrySlugForMegaMenuCityHref({
      leaf: opts.leaf,
      countryLabel: opts.countryLabel,
      headerBrowseCountryLabel: opts.headerBrowseCountryLabel,
    }),
  )
  appendMenuGroupParam(params, opts.countryLabel)
  params.set('city', citySlugFromLeaf(opts.leaf))
  return `${browseBasePath(scope)}?${params.toString()}`
}

export function buildProductsHrefSportsTheme(opts: {
  type: string
  sportsThemeKey: string
  scope?: BrowseHrefScope
}): string {
  const params = new URLSearchParams()
  appendBrowseTypeParamIfNarrowing(params, opts.type)
  const scope = opts.scope ?? 'overseas'
  if (scope === 'overseas') params.set('scope', 'overseas')
  else params.set('scope', 'domestic')
  params.set('region', 'sports_theme')
  params.set('sportsTheme', opts.sportsThemeKey.trim().toLowerCase())
  return `${browseBasePath(scope)}?${params.toString()}`
}

/** 메가메뉴 대분류(권역 탭) — 해당 대륙·권역 상품만 필터 */
export function buildProductsHrefRegionOnly(opts: {
  regionId: string
  type?: string
  scope?: BrowseHrefScope
}): string {
  const params = new URLSearchParams()
  appendBrowseTypeParamIfNarrowing(params, opts.type ?? 'travel')
  const scope = opts.scope ?? 'overseas'
  if (scope === 'overseas') params.set('scope', 'overseas')
  else params.set('scope', 'domestic')
  params.set('region', opts.regionId.trim())
  return `${browseBasePath(scope)}?${params.toString()}`
}

/** 메가메뉴 중분류(국가·스포츠 종목) 그룹 헤더 링크 */
export function buildMegaMenuGroupHeaderHref(opts: {
  type: string
  regionId: string
  countryLabel: string
  headerBrowseCountryLabel?: string
  scope?: BrowseHrefScope
}): string {
  if (opts.regionId === 'sports_theme') {
    const key = (opts.headerBrowseCountryLabel ?? opts.countryLabel).trim()
    return buildProductsHrefSportsTheme({
      type: opts.type,
      sportsThemeKey: key,
      scope: opts.scope,
    })
  }
  return buildProductsHrefCountryOnly(opts)
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
  appendMenuGroupParam(params, opts.countryLabel)
  return `${browseBasePath(scope)}?${params.toString()}`
}

/** 메가메뉴 leaf — `kind: 'country'`면 country-only URL, 아니면 city 포함 */
export function buildMegaMenuLeafHref(opts: {
  type: string
  regionId: string
  countryLabel: string
  headerBrowseCountryLabel?: string
  leaf: MegaMenuLeaf
  scope?: BrowseHrefScope
}): string {
  if (opts.regionId === 'sports_theme') {
    return buildProductsHrefSportsTheme({
      type: opts.type,
      sportsThemeKey: opts.leaf.browseCountryLabel ?? opts.leaf.label,
      scope: opts.scope,
    })
  }
  if (opts.leaf.kind === 'country') {
    return buildProductsHrefCountryOnly({
      type: opts.type,
      regionId: opts.regionId,
      countryLabel: opts.leaf.browseCountryLabel ?? opts.leaf.label,
      scope: opts.scope,
    })
  }
  return buildProductsHref({
    type: opts.type,
    regionId: opts.regionId,
    countryLabel: opts.countryLabel,
    headerBrowseCountryLabel: opts.headerBrowseCountryLabel,
    leaf: opts.leaf,
    scope: opts.scope,
  })
}

/**
 * URL 쿼리(region/country/city)로부터 상품 목적지 매칭용 terms.
 * city가 없으면 해당 국가 블록의 모든 도시 terms를 합친다.
 */
export function destinationTermsFromQuery(
  region: string | null,
  country: string | null,
  city: string | null,
  menuGroup: string | null = null,
): string[] {
  if (!region) return []
  const reg = TOP_NAV_MEGA_REGIONS.find((r) => r.id === region)
  if (!reg?.countryGroups) return []
  const menuGroupNorm = (menuGroup ?? '').trim().toLowerCase()
  if (menuGroupNorm) {
    const g = reg.countryGroups.find((x) => countrySlugFromLabel(x.countryLabel) === menuGroupNorm)
    if (g) {
      if (!city) {
        const out = new Set<string>()
        out.add(g.countryLabel)
        for (const c of g.cities) c.terms.forEach((t) => out.add(t))
        return [...out]
      }
      const leaf = g.cities.find((c) => citySlugFromTermsAndLabel(c.label, c.terms) === city)
      return leaf ? [...leaf.terms] : []
    }
  }

  if (!country) return []
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
      const slug = countrySlugForMegaMenuCityHref({
        leaf: c,
        countryLabel: g.countryLabel,
        headerBrowseCountryLabel: g.headerBrowseCountryLabel,
      })
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
