/**
 * 메가메뉴에 노출된 도시·국가만 상품 태그에 연결 (표기 없는 도시는 제외).
 */
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'

type MegaMenuCityTermEntry = { cityKey: string; terms: string[] }

let cachedCityKeys: Set<string> | null = null
let cachedCityTermIndex: MegaMenuCityTermEntry[] | null = null

function buildMegaMenuCityIndex(): { cityKeys: Set<string>; termIndex: MegaMenuCityTermEntry[] } {
  const cityKeys = new Set<string>()
  const byCityKey = new Map<string, Set<string>>()

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        const resolved = resolveBrowseCityKeysForFilter(slug)
        const terms = [...new Set([leaf.label, ...leaf.terms].map((t) => t.trim()).filter(Boolean))]
        for (const ck of resolved) {
          cityKeys.add(ck)
          const set = byCityKey.get(ck) ?? new Set<string>()
          for (const t of terms) set.add(t)
          byCityKey.set(ck, set)
        }
      }
    }
  }

  const termIndex: MegaMenuCityTermEntry[] = [...byCityKey.entries()].map(([cityKey, terms]) => ({
    cityKey,
    terms: [...terms],
  }))

  return { cityKeys, termIndex }
}

function ensureMegaMenuCityCache(): void {
  if (cachedCityKeys && cachedCityTermIndex) return
  const built = buildMegaMenuCityIndex()
  cachedCityKeys = built.cityKeys
  cachedCityTermIndex = built.termIndex
}

/** 메가메뉴 leaf에 대응하는 마스터 cityKey 집합 */
export function getMegaMenuCityKeys(): Set<string> {
  ensureMegaMenuCityCache()
  return cachedCityKeys!
}

/** 제목·목적지 문자열에서 메가메뉴 도시 토큰 매칭 → cityKey (메가메뉴 집합 ∩) */
export function matchMegaMenuCityKeysInHaystack(haystack: string): string[] {
  const h = haystack.trim().toLowerCase()
  if (!h) return []
  ensureMegaMenuCityCache()
  const mega = cachedCityKeys!
  const out = new Set<string>()
  for (const { cityKey, terms } of cachedCityTermIndex!) {
    if (!mega.has(cityKey)) continue
    for (const term of terms) {
      const t = term.toLowerCase()
      if (t.length < 2) continue
      if (h.includes(t)) {
        out.add(cityKey)
        break
      }
    }
  }
  return [...out]
}

/** cityKey가 메가메뉴 SSOT에 포함되는지 */
export function isMegaMenuCityKey(cityKey: string | null | undefined): boolean {
  const k = (cityKey ?? '').trim()
  if (!k) return false
  return getMegaMenuCityKeys().has(k)
}
