import { countryDisplayNameFromBrowseParam } from '@/lib/overseas-browse-country-hero'
import {
  buildMegaMenuLeafHref,
  buildProductsHrefCountryOnly,
  TOP_NAV_MEGA_REGIONS,
} from '@/lib/top-nav-resolve'

export type OverseasLocationSuggestion = {
  id: string
  label: string
  sublabel: string
  searchText: string
  href: string
  regionId: string
  countrySlug: string
  citySlug: string | null
  kind: 'country' | 'city'
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function matchesQuery(s: OverseasLocationSuggestion, query: string): boolean {
  const q = norm(query)
  if (!q) return true
  return (
    norm(s.label).includes(q) ||
    norm(s.sublabel).includes(q) ||
    s.searchText.includes(q)
  )
}

function scoreSuggestion(s: OverseasLocationSuggestion, query: string): number {
  const q = norm(query)
  const label = norm(s.label)
  if (!q) return s.kind === 'city' ? 10 : 0
  if (label === q) return 100
  if (label.startsWith(q)) return 80
  if (s.kind === 'city' && norm(s.sublabel).includes(q)) return 65
  if (s.searchText.includes(q)) return 50
  if (norm(s.sublabel).includes(q)) return 40
  return 0
}

function dedupeById(items: OverseasLocationSuggestion[]): OverseasLocationSuggestion[] {
  const seen = new Set<string>()
  const out: OverseasLocationSuggestion[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function sortByRelevance(items: OverseasLocationSuggestion[], query: string): OverseasLocationSuggestion[] {
  return [...items].sort((a, b) => {
    const diff = scoreSuggestion(b, query) - scoreSuggestion(a, query)
    if (diff !== 0) return diff
    if (a.kind !== b.kind) return a.kind === 'city' ? -1 : 1
    return a.label.localeCompare(b.label, 'ko')
  })
}

/** 메가메뉴 SSOT — 나라·도시 자동완성·히어로 검색 (메가메뉴 탭·열 순서 유지) */
export function buildOverseasMegaMenuLocationSuggestions(): OverseasLocationSuggestion[] {
  const out: OverseasLocationSuggestion[] = []
  const seen = new Set<string>()

  for (const region of TOP_NAV_MEGA_REGIONS) {
    if (region.localDeparture || !region.countryGroups?.length) continue
    for (const group of region.countryGroups) {
      if (!group.nonLinkHeader) {
        const countrySlug = buildProductsHrefCountryOnly({
          type: 'travel',
          regionId: region.id,
          countryLabel: group.countryLabel,
          headerBrowseCountryLabel: group.headerBrowseCountryLabel,
        })
        const countryUrl = new URL(countrySlug, 'https://bongtour.local')
        const cSlug = countryUrl.searchParams.get('country') ?? ''
        const id = `country:${region.id}:${cSlug}`
        if (!seen.has(id)) {
          seen.add(id)
          out.push({
            id,
            label: group.countryLabel,
            sublabel: region.label,
            searchText: norm(`${group.countryLabel} ${region.label} ${group.headerBrowseCountryLabel ?? ''}`),
            href: countrySlug,
            regionId: region.id,
            countrySlug: cSlug,
            citySlug: null,
            kind: 'country',
          })
        }
      }
      for (const leaf of group.cities) {
        const href = buildMegaMenuLeafHref({
          type: 'travel',
          regionId: region.id,
          countryLabel: group.countryLabel,
          headerBrowseCountryLabel: group.headerBrowseCountryLabel,
          leaf,
        })
        const url = new URL(href, 'https://bongtour.local')
        const countrySlug = url.searchParams.get('country') ?? ''
        const citySlug = url.searchParams.get('city')
        const id = `city:${region.id}:${countrySlug}:${citySlug ?? leaf.label}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push({
          id,
          label: leaf.label,
          sublabel: group.countryLabel,
          searchText: norm(
            `${leaf.label} ${group.countryLabel} ${region.label} ${(leaf.terms ?? []).join(' ')}`,
          ),
          href,
          regionId: region.id,
          countrySlug,
          citySlug,
          kind: 'city',
        })
      }
    }
  }

  return out
}

/**
 * 메가메뉴와 동일한 매칭: 기본·포커스는 도시, 국가명 입력 시 해당 국가 전체 + 소속 도시.
 */
export function filterOverseasLocationSuggestions(
  suggestions: OverseasLocationSuggestion[],
  query: string,
  limit = 8,
): OverseasLocationSuggestion[] {
  const q = norm(query)
  const countries = suggestions.filter((s) => s.kind === 'country')
  const cities = suggestions.filter((s) => s.kind === 'city')

  if (!q) {
    return cities.slice(0, limit)
  }

  const matchedCities = cities.filter((s) => matchesQuery(s, q))

  if (matchedCities.length > 0) {
    return sortByRelevance(matchedCities, query).slice(0, limit)
  }

  const countryPrimary = countries.filter((c) => {
    const label = norm(c.label)
    if (label === q) return true
    if (label.startsWith(q)) return q.length >= 2
    return false
  })

  if (countryPrimary.length > 0) {
    const expanded: OverseasLocationSuggestion[] = []
    for (const country of countryPrimary.slice(0, 2)) {
      expanded.push(country)
      for (const city of cities) {
        if (city.regionId !== country.regionId || city.countrySlug !== country.countrySlug) continue
        expanded.push(city)
      }
    }
    return dedupeById(expanded).slice(0, limit)
  }

  const matchedCountries = countries.filter((s) => matchesQuery(s, q))
  return sortByRelevance(matchedCountries, query).slice(0, limit)
}

export function overseasBrowseLabelFromParams(
  countrySlug: string | null,
  citySlug: string | null,
): string {
  const country = (countrySlug ?? '').trim()
  const city = (citySlug ?? '').trim()
  if (!country && !city) return ''
  const countryKr = country ? countryDisplayNameFromBrowseParam(country) ?? country : ''
  if (!city) return countryKr
  const suggestions = buildOverseasMegaMenuLocationSuggestions()
  const hit = suggestions.find((s) => s.countrySlug === country && s.citySlug === city)
  if (hit) return `${hit.label} · ${hit.sublabel}`
  if (countryKr) return `${city} · ${countryKr}`
  return city
}

export function findSuggestionByBrowseParams(
  suggestions: OverseasLocationSuggestion[],
  region: string | null,
  country: string | null,
  city: string | null,
): OverseasLocationSuggestion | null {
  const r = (region ?? '').trim()
  const c = (country ?? '').trim()
  const citySlug = (city ?? '').trim()
  if (!c) return null
  return (
    suggestions.find((s) => {
      if (s.countrySlug !== c) return false
      if (citySlug) return s.citySlug === citySlug
      return s.kind === 'country' && (!s.citySlug || s.citySlug === '')
    }) ??
    suggestions.find((s) => s.countrySlug === c && s.citySlug === citySlug) ??
    null
  )
}
