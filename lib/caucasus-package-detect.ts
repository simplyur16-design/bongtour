import { termAppearsInHaystack } from '@/lib/geo-haystack-match'
import type { MatchProductToOverseasNodeResult } from '@/lib/match-overseas-product'

/** 코카서스 3국 패키지 — 메가메뉴·geo·도시 태그 SSOT */
export const CAUCASUS_PACKAGE_MARKERS = ['코카서스', '카카서스', 'caucasus'] as const

export const CAUCASUS_COUNTRY_KEY_SET = new Set(['caucasus', 'georgia', 'azerbaijan', 'armenia'])

const CAUCASUS_COUNTRY_TERM_GROUPS: readonly (readonly string[])[] = [
  ['조지아', 'georgia', '트빌리시', 'tbilisi'],
  ['아제르바이잔', 'azerbaijan', '바쿠', 'baku'],
  ['아르메니아', 'armenia', '예레반', 'yerevan'],
] as const

/** haystack에 등장한 코카서스 3국 중 몇 개국 힌트인지 (0~3) */
export function countCaucasusCountryGroupsInHaystack(haystack: string): number {
  let n = 0
  for (const group of CAUCASUS_COUNTRY_TERM_GROUPS) {
    if (group.some((term) => termAppearsInHaystack(term, haystack))) n++
  }
  return n
}

export function detectCaucasusPackageFromHaystack(haystack: string): boolean {
  const h = haystack.trim()
  if (!h) return false
  if (CAUCASUS_PACKAGE_MARKERS.some((m) => termAppearsInHaystack(m, h))) return true
  if (countCaucasusCountryGroupsInHaystack(h) >= 2) return true
  if (/\d+\s*국/u.test(h) && countCaucasusCountryGroupsInHaystack(h) >= 1) return true
  return false
}

export function detectCaucasusPackageFromKeys(keys: readonly string[]): boolean {
  const norm = keys.map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (norm.includes('caucasus')) return true
  const hits = ['georgia', 'azerbaijan', 'armenia'].filter((k) => norm.includes(k))
  return hits.length >= 2
}

/** 두바이 연계 포함 코카서스 3국 — `middle-east`·`dubai` 매칭보다 우선 */
export function buildCaucasusPackageTreeMatch(matchedTerm = '코카서스'): MatchProductToOverseasNodeResult {
  return {
    scope: 'country',
    groupKey: 'europe-me-africa',
    groupLabel: '유럽·중동·아프리카',
    countryKey: 'caucasus',
    countryLabel: '코카서스 3국',
    matchedTerm,
  }
}

export function isMiddleEastOrDubaiMatch(match: MatchProductToOverseasNodeResult | null): boolean {
  if (!match) return false
  const ck = (match.countryKey ?? '').trim().toLowerCase()
  const lk = (match.leafKey ?? '').trim().toLowerCase()
  return ck === 'middle-east' || lk === 'dubai' || lk === 'abudhabi'
}
