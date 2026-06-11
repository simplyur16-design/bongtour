import type { ResultItem } from '@/components/products/ProductResultsList'
import { computeHubFocusedResults } from '@/lib/hub-focused-results'
import { interleaveProductsBySupplier } from '@/lib/interleave-products-by-supplier'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import {
  computeMegaMenuRegionCityGroupId,
  megaMenuSubgroupLabelsInOrder,
} from '@/lib/overseas-mega-region-city-group'
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'
import {
  SPORTS_THEME_TAG_LABELS,
  SPORTS_THEME_TAG_VALUES,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'
import { sortProductsBySeason } from '@/lib/product-sort'
import { parseBrowseQuery } from '@/lib/products-browse-query'

export type OverseasHubCatalogSection = {
  key: string
  label: string
  items: ResultItem[]
  seasonalPickIds: string[]
}

function sortWithSeasonalPicks(
  items: ResultItem[],
  seasonalPickIds: ReadonlySet<string>,
): ResultItem[] {
  if (seasonalPickIds.size === 0) return items
  return [
    ...items.filter((p) => seasonalPickIds.has(p.id)),
    ...items.filter((p) => !seasonalPickIds.has(p.id)),
  ]
}

function seasonalPickIdsForSection(
  sectionItems: ResultItem[],
  globalPickIds: ReadonlySet<string>,
): string[] {
  if (globalPickIds.size === 0) return []
  const ids = new Set(sectionItems.map((it) => it.id))
  return [...globalPickIds].filter((id) => ids.has(id))
}

function normalizeHubSubgroupFallbackLabel(regionId: string, label: string): string {
  if (regionId === 'americas') {
    if (label === '미국동부') return '미동부'
    if (label === '미국서부') return '미서부'
  }
  return label
}

/** 허브 클라이언트 — API 필드만 사용 (트리·메가메뉴 term 스캔 금지) */
function resolveMegaSubgroupLabelForHubItem(item: ResultItem, regionId: string): string {
  const preset = (item.browseMegaSubgroupLabel ?? '').trim()
  if (preset && preset !== '기타') return preset
  const row = normalizeHubSubgroupFallbackLabel(regionId, (item.countryRowLabel ?? '').trim())
  if (row && row !== '기타') return row
  return '기타'
}

/** 기본 허브 — 권역 대분류 버킷 */
export function buildOverseasHubCatalogSections(items: ResultItem[]): OverseasHubCatalogSection[] {
  const byBucket = new Map<OverseasDisplayBucketId, ResultItem[]>()
  for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) byBucket.set(id, [])
  for (const item of items) {
    const bucket: OverseasDisplayBucketId = item.overseasBucket ?? 'other'
    if (!byBucket.has(bucket)) byBucket.set(bucket, [])
    byBucket.get(bucket)!.push(item)
  }
  const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
  return OVERSEAS_DISPLAY_BUCKET_ORDER.map((bucketId) => {
    const raw = byBucket.get(bucketId) ?? []
    const { items: sorted, seasonalPickIds } = sortProductsBySeason(raw, seoulMonth)
    return {
      key: `bucket:${bucketId}`,
      label: OVERSEAS_DISPLAY_BUCKET_LABEL[bucketId],
      items: sorted,
      seasonalPickIds: [...seasonalPickIds],
    }
  }).filter((s) => s.items.length > 0)
}

/** 메가메뉴 대분류(`region=japan` 등) — 하위 지역·국가 열 */
export function buildOverseasHubMegaSubgroupSections(
  items: ResultItem[],
  megaRegionId: string,
): OverseasHubCatalogSection[] {
  const regionId = megaRegionId.trim()
  if (!regionId || items.length === 0) return []

  const subgroupOrder = megaMenuSubgroupLabelsInOrder(regionId)
  const bySubgroup = new Map<string, ResultItem[]>()

  for (const item of items) {
    const key = resolveMegaSubgroupLabelForHubItem(item, regionId)
    const list = bySubgroup.get(key) ?? []
    list.push(item)
    bySubgroup.set(key, list)
  }

  const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
  const { seasonalPickIds } = sortProductsBySeason(items, seoulMonth)

  const orderedLabels = [
    ...subgroupOrder.filter((label) => (bySubgroup.get(label)?.length ?? 0) > 0),
    ...[...bySubgroup.keys()]
      .filter((label) => !subgroupOrder.includes(label))
      .sort((a, b) => a.localeCompare(b, 'ko')),
  ]

  return orderedLabels.map((label) => {
    const sectionItems = interleaveProductsBySupplier(
      sortWithSeasonalPicks(bySubgroup.get(label) ?? [], seasonalPickIds),
    )
    return {
      key: `mega:${regionId}:${label}`,
      label,
      items: sectionItems,
      seasonalPickIds: seasonalPickIdsForSection(sectionItems, seasonalPickIds),
    }
  })
}

/** `country`만 선택 — 단일 국가 헤더 */
export function buildOverseasHubCountryFlatSections(
  items: ResultItem[],
  countrySlug: string,
): OverseasHubCatalogSection[] {
  const slug = countrySlug.trim().toLowerCase()
  if (!slug || items.length === 0) return []
  const heading = koreanCountryLabelFromBrowseSlug(slug) ?? slug
  const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
  const { items: sorted, seasonalPickIds } = sortProductsBySeason(items, seoulMonth)
  return [
    {
      key: `country:${slug}`,
      label: heading,
      items: interleaveProductsBySupplier(sorted),
      seasonalPickIds: [...seasonalPickIds],
    },
  ]
}

/** 도시·기타 좁힌 목록 — 섹션 헤더 없음 */
export function buildOverseasHubFocusedFlatSections(items: ResultItem[]): OverseasHubCatalogSection[] {
  if (items.length === 0) return []
  const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
  const { items: sorted, seasonalPickIds } = sortProductsBySeason(items, seoulMonth)
  return [
    {
      key: 'focused',
      label: '',
      items: sorted,
      seasonalPickIds: [...seasonalPickIds],
    },
  ]
}

/** `region=sports_theme` — 종목별 섹션 (러닝·트레킹·…) */
export function buildOverseasHubSportsThemeSections(items: ResultItem[]): OverseasHubCatalogSection[] {
  if (items.length === 0) return []

  const byTag = new Map<SportsThemeTag, ResultItem[]>()
  for (const key of SPORTS_THEME_TAG_VALUES) byTag.set(key, [])

  for (const item of items) {
    const tags = item.sportsThemeTags ?? []
    const seen = new Set<SportsThemeTag>()
    for (const raw of tags) {
      if (!SPORTS_THEME_TAG_VALUES.includes(raw as SportsThemeTag)) continue
      const tag = raw as SportsThemeTag
      if (seen.has(tag)) continue
      seen.add(tag)
      byTag.get(tag)!.push(item)
    }
  }

  const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
  const { seasonalPickIds } = sortProductsBySeason(items, seoulMonth)

  return SPORTS_THEME_TAG_VALUES.map((tag) => {
    const sectionItems = interleaveProductsBySupplier(
      sortWithSeasonalPicks(byTag.get(tag) ?? [], seasonalPickIds),
    )
    return {
      key: `sports:${tag}`,
      label: SPORTS_THEME_TAG_LABELS[tag],
      items: sectionItems,
      seasonalPickIds: seasonalPickIdsForSection(sectionItems, seasonalPickIds),
    }
  }).filter((section) => section.items.length > 0)
}

/** URL·필터 결과에 맞는 섹션 레이아웃 SSOT */
export function buildOverseasHubCatalogSectionsForUrl(
  items: ResultItem[],
  searchParams: URLSearchParams,
): OverseasHubCatalogSection[] {
  if (items.length === 0) return []

  const q = parseBrowseQuery(searchParams)
  const region = (q.region ?? '').trim()
  const sportsThemeFilter = (q.sportsTheme ?? '').trim()
  if (region === 'sports_theme' && !sportsThemeFilter) {
    return buildOverseasHubSportsThemeSections(items)
  }

  const megaRegionId = computeMegaMenuRegionCityGroupId({
    pathname: '/travel/overseas',
    defaultScope: 'overseas',
    searchParams,
  })
  if (megaRegionId) {
    return buildOverseasHubMegaSubgroupSections(items, megaRegionId)
  }

  const hubFocused = computeHubFocusedResults({
    pathname: '/travel/overseas',
    defaultScope: 'overseas',
    searchParams,
  })

  if (hubFocused) {
    const country = (parseBrowseQuery(searchParams).country ?? '').trim()
    if (country) {
      return buildOverseasHubCountryFlatSections(items, country)
    }
    return buildOverseasHubFocusedFlatSections(items)
  }

  return buildOverseasHubCatalogSections(items)
}
