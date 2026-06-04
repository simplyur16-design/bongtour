/**
 * 메가메뉴 도시 haystack 매칭용 — 여러 도시에 공통으로 붙는 토큰(일본, 간사이 등) 제외.
 */
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

/** cityKey → 도시 전용 매칭 토큰 (공통 토큰 제거 후) */
export type MegaMenuCityHaystackIndex = {
  cityKeys: Set<string>
  termIndex: Array<{ cityKey: string; terms: string[] }>
}

function collectRawCityTermIndex(): Map<string, Set<string>> {
  const byCityKey = new Map<string, Set<string>>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        const resolved = resolveBrowseCityKeysForFilter(slug)
        const terms = [...new Set([leaf.label, ...leaf.terms].map((t) => t.trim()).filter(Boolean))]
        for (const ck of resolved) {
          const set = byCityKey.get(ck) ?? new Set<string>()
          for (const t of terms) set.add(t)
          byCityKey.set(ck, set)
        }
      }
    }
  }
  return byCityKey
}

/**
 * 2개 이상 메가메뉴 도시 leaf에 동시에 등장하는 토큰 — haystack 도시 태그에서 제외.
 * cityKey( la / los-angeles / lasvegas 등 browse 별칭)가 아니라 leaf 단위로 센다.
 */
export function buildMegaMenuSharedCityHaystackStopTerms(): Set<string> {
  const termHits = new Map<string, number>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const seenInLeaf = new Set<string>()
        for (const raw of [leaf.label, ...leaf.terms]) {
          const t = raw.trim().toLowerCase()
          if (t.length < 2 || seenInLeaf.has(t)) continue
          seenInLeaf.add(t)
          termHits.set(t, (termHits.get(t) ?? 0) + 1)
        }
      }
    }
  }
  const stops = new Set<string>()
  for (const [term, count] of termHits) {
    if (count >= 2) stops.add(term)
  }
  return stops
}

export function buildMegaMenuCityHaystackIndex(): MegaMenuCityHaystackIndex {
  const stops = buildMegaMenuSharedCityHaystackStopTerms()
  const byCityKey = collectRawCityTermIndex()
  const cityKeys = new Set<string>()
  const termIndex: MegaMenuCityHaystackIndex['termIndex'] = []

  for (const [cityKey, rawTerms] of byCityKey) {
    cityKeys.add(cityKey)
    const terms = [...rawTerms].filter((t) => {
      const low = t.trim().toLowerCase()
      return low.length >= 2 && !stops.has(low)
    })
    if (terms.length === 0) {
      const labelOnly = [...rawTerms].map((t) => t.trim()).find((t) => t.length >= 2 && !stops.has(t.toLowerCase()))
      if (labelOnly) terms.push(labelOnly)
      else {
        const fallback = [...rawTerms].find((t) => t.trim().length >= 2)
        if (fallback) terms.push(fallback.trim())
      }
    }
    termIndex.push({ cityKey, terms })
  }

  return { cityKeys, termIndex }
}
