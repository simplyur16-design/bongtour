/**
 * 목록 수집 클릭 라벨 — 우리 메가메뉴 leaf만. 마케팅 destination 문장 금지.
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 메가메뉴 나라·도시만 클릭 — manifest
 * REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: cluster 펼침으로 가마쿠라→요코하마 금지 — manifest
 */
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { citySlugFromTermsAndLabel, countrySlugFromLabel } from '@/lib/location-url-slugs'

function compactCityKey(s: string): string {
  return s.trim().toLowerCase().replace(/[-_\s]/g, '')
}

/** leaf slug·terms·라벨 정확 매칭만. browse cluster 펼침(가마쿠라⊂요코하마) 금지. */
function cityKeyMatchesLeaf(cityKey: string, label: string, terms: string[]): boolean {
  const k = cityKey.trim().toLowerCase()
  if (!k) return false
  const slug = citySlugFromTermsAndLabel(label, terms).toLowerCase()
  if (slug === k) return true
  // bigisland ↔ big-island · grandcanyon ↔ grand-canyon
  if (compactCityKey(slug) === compactCityKey(k)) return true
  if (k === label.trim().toLowerCase()) return true
  return terms.some((t) => {
    const tt = t.trim().toLowerCase()
    return tt === k || compactCityKey(tt) === compactCityKey(k)
  })
}

function countryKeyMatchesLeaf(countryKey: string, label: string, terms: string[]): boolean {
  const k = countryKey.trim().toLowerCase()
  if (!k) return false
  if (countrySlugFromLabel(label).toLowerCase() === k) return true
  if (label.toLowerCase() === k) return true
  return terms.some((t) => t.trim().toLowerCase() === k)
}

/**
 * cityKey → 메가메뉴 한글 라벨.
 * 도시 leaf를 국가 leaf보다 우선 (도시는 도시, 나라는 나라).
 * REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: city kind first — manifest
 */
export function megaMenuClickLabelForCityKey(cityKey: string | null | undefined): string {
  const k = String(cityKey ?? '').trim()
  if (!k) return ''
  let countryFallback = ''
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (!cityKeyMatchesLeaf(k, leaf.label, leaf.terms)) continue
        if (leaf.kind === 'city') return leaf.label
        if (!countryFallback) countryFallback = leaf.label
      }
    }
  }
  return countryFallback
}

/** countryKey가 메가메뉴 국가 leaf에 있으면 그 한글 라벨. */
export function megaMenuClickLabelForCountryKey(countryKey: string | null | undefined): string {
  const k = String(countryKey ?? '').trim()
  if (!k) return ''
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'country') continue
        if (countryKeyMatchesLeaf(k, leaf.label, leaf.terms)) return leaf.label
      }
    }
  }
  return ''
}

/** 슬롯 → 공급사 사이트에서 누를 메가메뉴 지명. 없으면 빈 문자열(그 슬롯은 안 봄). */
export function megaMenuClickLabelForIngestSlot(args: {
  cityKey: string | null
  countryKey: string
}): string {
  const city = megaMenuClickLabelForCityKey(args.cityKey)
  if (city) return city
  return megaMenuClickLabelForCountryKey(args.countryKey)
}
