/**
 * 메가메뉴 자동 정리 — 공개 상품 수에 따라 탭·중분류·도시를 숨기고 많은 순으로 정렬한다.
 * 사장님 2026-11-22 00:50 "메가메뉴의 틀도 고정하지말고 우리가 가져오는 상품에 따라 잘 정리되게하면될것같아."
 * - 수(count)는 링크 href(browse URL) 기준 공개 상품 수. 서버 `/api/mega-menu/counts`가 1시간 캐시로 계산한다.
 * - 수를 모르면(로딩 전·실패) 원래 메뉴를 그대로 둔다(빈 메뉴로 사라지지 않게).
 * - 0인 도시·중분류·탭은 숨긴다. 남은 항목은 상품 수가 많은 순(같으면 원래 순서).
 * - 지역 탭은 많은 순, 테마여행·지방출발 탭은 지역 탭 뒤에 둔다.
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 공개 상품 수 기준 메뉴 자동 숨김·정렬, 수 모르면 원래 메뉴 — manifest
 */
import type { MegaMenuRegion, MegaMenuCountryGroup, MegaMenuLeaf } from '@/lib/unified-location-tree'
import {
  buildMegaMenuGroupHeaderHref,
  buildMegaMenuLeafHref,
  buildProductsHrefRegionOnly,
} from '@/lib/top-nav-resolve'

export const MEGA_MENU_LIVE_TYPE = 'travel'

export type MegaMenuLiveCounts = Record<string, number>

export function megaMenuRegionHref(r: MegaMenuRegion): string {
  return buildProductsHrefRegionOnly({ regionId: r.id })
}

export function megaMenuGroupHref(r: MegaMenuRegion, g: MegaMenuCountryGroup): string | null {
  if (g.nonLinkHeader) return null
  return buildMegaMenuGroupHeaderHref({
    type: MEGA_MENU_LIVE_TYPE,
    regionId: r.id,
    countryLabel: g.countryLabel,
    headerBrowseCountryLabel: g.headerBrowseCountryLabel,
  })
}

export function megaMenuLeafHref(r: MegaMenuRegion, g: MegaMenuCountryGroup, leaf: MegaMenuLeaf): string {
  return buildMegaMenuLeafHref({
    type: MEGA_MENU_LIVE_TYPE,
    regionId: r.id,
    countryLabel: g.countryLabel,
    headerBrowseCountryLabel: g.headerBrowseCountryLabel,
    leaf,
  })
}

/** 메뉴에 있는 모든 링크(탭·중분류 헤더·도시) — 중복 제거, 원래 순서 */
export function collectMegaMenuHrefs(regions: ReadonlyArray<MegaMenuRegion>): string[] {
  const out = new Set<string>()
  for (const r of regions) {
    out.add(megaMenuRegionHref(r))
    for (const g of r.countryGroups ?? []) {
      const gh = megaMenuGroupHref(r, g)
      if (gh) out.add(gh)
      for (const c of g.cities) out.add(megaMenuLeafHref(r, g, c))
    }
  }
  return [...out]
}

function countOf(counts: MegaMenuLiveCounts, href: string | null): number | null {
  if (!href) return null
  const v = counts[href]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function stableSortDesc<T>(items: T[], score: (t: T) => number): T[] {
  return items
    .map((t, i) => ({ t, i, s: score(t) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t)
}

function isTailTab(r: MegaMenuRegion): boolean {
  return Boolean(r.localDeparture) || r.id === 'sports_theme'
}

/**
 * 수에 따라 메뉴 정리. counts가 null이면 그대로 반환.
 * 수를 모르는 항목(counts에 없음)은 보이는 쪽으로 둔다.
 */
export function arrangeMegaMenuRegionsByCounts(
  regions: ReadonlyArray<MegaMenuRegion>,
  counts: MegaMenuLiveCounts | null,
): MegaMenuRegion[] {
  if (!counts) return [...regions]
  const kept: Array<{ r: MegaMenuRegion; score: number }> = []
  for (const r of regions) {
    const regionCount = countOf(counts, megaMenuRegionHref(r))
    if (r.localDeparture) {
      if (regionCount === 0) continue
      kept.push({ r, score: regionCount ?? 0 })
      continue
    }
    const groups: Array<{ g: MegaMenuCountryGroup; score: number }> = []
    for (const g of r.countryGroups ?? []) {
      const leaves = g.cities.filter((c) => countOf(counts, megaMenuLeafHref(r, g, c)) !== 0)
      const sortedLeaves = stableSortDesc(leaves, (c) => countOf(counts, megaMenuLeafHref(r, g, c)) ?? 0)
      const headerCount = countOf(counts, megaMenuGroupHref(r, g))
      const leafSum = sortedLeaves.reduce((a, c) => a + (countOf(counts, megaMenuLeafHref(r, g, c)) ?? 0), 0)
      if (sortedLeaves.length === 0 && (headerCount === null || headerCount === 0)) continue
      groups.push({ g: { ...g, cities: sortedLeaves }, score: headerCount ?? leafSum })
    }
    if (groups.length === 0) continue
    if (regionCount === 0) continue
    const sortedGroups = stableSortDesc(groups, (x) => x.score).map((x) => x.g)
    kept.push({ r: { ...r, countryGroups: sortedGroups }, score: regionCount ?? groups.reduce((a, x) => a + x.score, 0) })
  }
  const head = stableSortDesc(
    kept.filter((x) => !isTailTab(x.r)),
    (x) => x.score,
  )
  const tail = kept.filter((x) => isTailTab(x.r))
  return [...head, ...tail].map((x) => x.r)
}

/** 매시 점검용: 수가 0인데 메뉴 원본에 있는 링크(=자동으로 숨겨지는 빈 메뉴) */
export function listEmptyMegaMenuHrefs(
  regions: ReadonlyArray<MegaMenuRegion>,
  counts: MegaMenuLiveCounts,
): string[] {
  return collectMegaMenuHrefs(regions).filter((h) => counts[h] === 0)
}
