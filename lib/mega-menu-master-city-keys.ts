/**
 * 메가메뉴에 노출된 도시·국가만 상품 태그에 연결 (표기 없는 도시는 제외).
 */
import { termAppearsInHaystack } from '@/lib/geo-haystack-match'
import {
  buildMegaMenuCityHaystackIndex,
  type MegaMenuCityHaystackIndex,
} from '@/lib/mega-menu-city-haystack-terms'

let cached: MegaMenuCityHaystackIndex | null = null

function ensureMegaMenuCityCache(): void {
  if (cached) return
  cached = buildMegaMenuCityHaystackIndex()
}

/** 메가메뉴 leaf에 대응하는 마스터 cityKey 집합 */
export function getMegaMenuCityKeys(): Set<string> {
  ensureMegaMenuCityCache()
  return cached!.cityKeys
}

/** 제목·목적지 문자열에서 메가메뉴 도시 토큰 매칭 → cityKey (메가메뉴 집합 ∩) */
export function matchMegaMenuCityKeysInHaystack(haystack: string): string[] {
  const h = haystack.trim()
  if (!h) return []
  ensureMegaMenuCityCache()
  const mega = cached!.cityKeys
  const out = new Set<string>()
  for (const { cityKey, terms } of cached!.termIndex) {
    if (!mega.has(cityKey)) continue
    for (const term of terms) {
      if (term.trim().length < 2) continue
      if (termAppearsInHaystack(term, h)) {
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
