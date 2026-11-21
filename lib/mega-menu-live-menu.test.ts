/**
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 메뉴 자동 숨김·정렬, 수 모르면 원래 메뉴 — manifest
 */
import { describe, expect, it } from 'vitest'
import type { MegaMenuRegion } from '@/lib/unified-location-tree'
import {
  arrangeMegaMenuRegionsByCounts,
  collectMegaMenuHrefs,
  listEmptyMegaMenuHrefs,
  megaMenuGroupHref,
  megaMenuLeafHref,
  megaMenuRegionHref,
} from '@/lib/mega-menu-live-menu'
import { MENU_HEALTH_CHECKS } from '@/lib/site-health-menu-checks'
import { runHealthChecks } from '@/lib/site-health-registry'

const leaf = (label: string) => ({ label, terms: [label], kind: 'city' as const })
const regions: MegaMenuRegion[] = [
  {
    id: 'japan',
    label: '일본',
    countryGroups: [
      { countryLabel: '규슈', headerBrowseCountryLabel: '일본', cities: [leaf('후쿠오카'), leaf('벳푸')] },
      { countryLabel: '홋카이도', headerBrowseCountryLabel: '일본', cities: [leaf('삿포로')] },
    ],
  },
  {
    id: 'europe-me',
    label: '유럽',
    countryGroups: [{ countryLabel: '이탈리아', cities: [leaf('로마'), leaf('밀라노')] }],
  },
  { id: 'busan_dep', label: '부산출발', countryGroups: [], localDeparture: 'busan' },
  { id: 'jeju_dep', label: '제주출발', countryGroups: [], localDeparture: 'jeju' },
]
const jp = regions[0]!
const eu = regions[1]!
const g = (r: MegaMenuRegion, i: number) => r.countryGroups![i]!

function countsWith(over: Record<string, number>): Record<string, number> {
  const base: Record<string, number> = {}
  for (const h of collectMegaMenuHrefs(regions)) base[h] = 1
  return { ...base, ...over }
}

describe('mega menu live arrange', () => {
  it('counts 없으면 원래 메뉴 그대로', () => {
    expect(arrangeMegaMenuRegionsByCounts(regions, null)).toEqual(regions)
  })

  it('0인 도시·중분류·탭 숨김, 많은 순 정렬, 지방출발은 뒤', () => {
    const counts = countsWith({
      [megaMenuRegionHref(jp)]: 5,
      [megaMenuRegionHref(eu)]: 30,
      [megaMenuGroupHref(jp, g(jp, 0))!]: 2,
      [megaMenuLeafHref(jp, g(jp, 0), leaf('후쿠오카'))]: 0,
      [megaMenuLeafHref(jp, g(jp, 0), leaf('벳푸'))]: 2,
      [megaMenuGroupHref(jp, g(jp, 1))!]: 3,
      [megaMenuLeafHref(eu, g(eu, 0), leaf('로마'))]: 4,
      [megaMenuLeafHref(eu, g(eu, 0), leaf('밀라노'))]: 9,
      [megaMenuRegionHref(regions[3]!)]: 0,
      [megaMenuRegionHref(regions[2]!)]: 7,
    })
    const out = arrangeMegaMenuRegionsByCounts(regions, counts)
    expect(out.map((r) => r.id)).toEqual(['europe-me', 'japan', 'busan_dep'])
    expect(out[0]!.countryGroups![0]!.cities.map((c) => c.label)).toEqual(['밀라노', '로마'])
    expect(out[1]!.countryGroups!.map((x) => x.countryLabel)).toEqual(['홋카이도', '규슈'])
    expect(out[1]!.countryGroups![1]!.cities.map((c) => c.label)).toEqual(['벳푸'])
  })

  it('하위가 모두 0이고 헤더도 0이면 중분류 숨김, 탭도 숨김', () => {
    const counts = countsWith({
      [megaMenuRegionHref(eu)]: 0,
      [megaMenuGroupHref(eu, g(eu, 0))!]: 0,
      [megaMenuLeafHref(eu, g(eu, 0), leaf('로마'))]: 0,
      [megaMenuLeafHref(eu, g(eu, 0), leaf('밀라노'))]: 0,
    })
    const out = arrangeMegaMenuRegionsByCounts(regions, counts)
    expect(out.find((r) => r.id === 'europe-me')).toBeUndefined()
    expect(listEmptyMegaMenuHrefs(regions, counts).length).toBe(4)
  })

  it('매시 점검: 숨김·보이는데 0건·깨진 링크 기록(연결 실패는 건너뜀)', async () => {
    const hrefs = collectMegaMenuHrefs(regions)
    const counts = countsWith({ [hrefs[1]!]: 0 })
    const out = await runHealthChecks(MENU_HEALTH_CHECKS, {
      hrefs,
      counts,
      probes: [
        { href: hrefs[0]!, pageStatus: 200, listTotal: 0 },
        { href: hrefs[2]!, pageStatus: 404, listTotal: 3 },
        { href: hrefs[3]!, pageStatus: 0, listTotal: null },
      ],
    })
    const by = Object.fromEntries(out.map((s) => [s.id, s.found]))
    expect(by).toEqual({ 'menu-hidden-empty': 1, 'menu-shown-empty': 1, 'menu-broken-link': 1 })
    expect(out.every((s) => s.kind === 'code' && s.fixed === 0)).toBe(true)
  })
})
