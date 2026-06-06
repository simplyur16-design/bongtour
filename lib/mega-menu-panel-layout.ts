/**
 * 해외 메가메뉴 패널 — 국가 그룹 수에 따른 열·스크롤 SSOT.
 * 동남아(14그룹) 등은 7열 2행으로 스크롤 없이 한눈에 노출.
 */

const GRID_COLS_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
}

/** 탭·그룹 수 → 그리드 열 수 (flatGrid 탭 제외) */
export function megaMenuPanelColumnCount(regionId: string, groupCount: number): number {
  if (regionId === 'south-america' || regionId === 'sports_theme') return 4
  if (groupCount <= 4) return 4
  if (groupCount <= 8) return 4
  if (groupCount <= 10) return 5
  if (groupCount <= 12) return 6
  return 7
}

function maxCitiesInGroups(groups: { cities: unknown[] }[]): number {
  let m = 0
  for (const g of groups) m = Math.max(m, g.cities.length)
  return m
}

/** 패널 내부 세로 스크롤 필요 여부 (대략적 행 높이 추정) */
export function megaMenuPanelUsesInnerScroll(
  regionId: string,
  groupCount: number,
  maxCitiesPerGroup: number,
): boolean {
  if (regionId === 'south-america' || regionId === 'sports_theme') return false
  const cols = megaMenuPanelColumnCount(regionId, groupCount)
  const rows = Math.ceil(groupCount / cols)
  const rowPx = 32 + maxCitiesPerGroup * 28
  const totalPx = rows * rowPx + 40
  return rows > 2 || totalPx > 540
}

export type MegaMenuPanelLayout = {
  gridColsClass: string
  gridMaxWidthClass: string
  compact: boolean
  innerScroll: boolean
}

export function resolveMegaMenuPanelLayout(
  regionId: string,
  countryGroups: { cities: unknown[] }[],
): MegaMenuPanelLayout {
  const n = countryGroups.length
  const cols = megaMenuPanelColumnCount(regionId, n)
  const maxCities = maxCitiesInGroups(countryGroups)
  const innerScroll = megaMenuPanelUsesInnerScroll(regionId, n, maxCities)
  const compact = n >= 10 && !innerScroll
  return {
    gridColsClass: GRID_COLS_CLASS[cols] ?? 'grid-cols-4',
    gridMaxWidthClass: cols >= 7 ? 'max-w-[1280px]' : 'max-w-[1200px]',
    compact,
    innerScroll,
  }
}
