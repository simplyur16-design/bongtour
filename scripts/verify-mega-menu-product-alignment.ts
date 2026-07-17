/**
 * registered 해외 상품 — 메가메뉴 대·중·소분류 정합 (DB).
 * REGRESSION-FREEZE[mega-menu-product-alignment]: manifest
 *
 * npm run verify:mega-menu-product-alignment
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import {
  buildRegisterMegaMenuGeoSummary,
  megaMenuSummaryNeedsOperatorReview,
  type RegisterMegaMenuGeoSummary,
} from '@/lib/register-mega-menu-geo-summary'
import { buildOverseasBrowseGeoResolution } from '@/lib/browse-master-geo'
import { productMatchesBrowseUrlGeo } from '@/lib/match-overseas-product'
import {
  buildMegaMenuLeafHref,
  buildProductsHrefCountryOnly,
} from '@/lib/top-nav-resolve'
import { OVERSEAS_MEGA_MENU_REGIONS } from '@/lib/travel-landing-mega-menu-data'
import {
  isMegaMenuRegionCityGroupTabId,
  megaMenuSubgroupLabelsInOrder,
} from '@/lib/overseas-mega-region-city-group'
import { megaMenuPlacementForCityKey } from '@/lib/mega-menu-city-group-coherence'
import { citySlugFromTermsAndLabel, countrySlugFromLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'
import {
  isAmericasSouthAmericaBrowseCountryKey,
  isCentralAsiaBrowseCountryKey,
} from '@/lib/unified-location-tree'

type Issue = { slug: string; kind: string; detail: string }

type ProductRow = {
  id: string
  slug: string | null
  title: string
  travelScope: string | null
  primaryDestination: string | null
  destinationRaw: string | null
  schedule: string | null
  countryKey: string | null
  cityKey: string | null
  nodeKey: string | null
  groupKey: string | null
  countryTags: Array<{ countryKey: string; nodeKey: string | null; isPrimary: boolean }>
  cityTags: Array<{ cityKey: string; isPrimary: boolean }>
}

function scheduleHaystack(schedule: string | null): string | null {
  if (!schedule?.trim()) return null
  const rows = getScheduleFromProduct({ schedule })
  const t = rows
    .map((d) => [d.title, d.description, d.routeText].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
  return t.length ? t : null
}

function shouldHealLatinCaribbeanCluster(p: ProductRow): boolean {
  if (p.countryTags.length > 0) return false
  const ck = (p.countryKey ?? '').trim()
  const nk = (p.nodeKey ?? '').trim()
  return (
    ck === 'latin-caribbean' ||
    nk === 'south-america' ||
    (ck.length > 0 && isAmericasSouthAmericaBrowseCountryKey(ck) && !p.cityKey)
  )
}

function isHashtagNoiseDestination(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim()
  if (!t || t === '미지정') return true
  if (/^#/.test(t)) return true
  if (/노쇼핑|노옵션/.test(t) && !/우즈베|카자흐|키르기스|중앙아시아|uzbekistan|kazakhstan|kyrgyzstan/i.test(t)) {
    return true
  }
  return false
}

function shouldHealCentralAsiaCluster(p: ProductRow): boolean {
  if (p.countryTags.length > 0) return false
  const ck = (p.countryKey ?? '').trim()
  if (ck === 'central-asia' || isCentralAsiaBrowseCountryKey(ck)) return true
  const hay = [p.title, p.primaryDestination, p.destinationRaw].filter(Boolean).join(' ')
  return /중앙아시아|우즈베키스탄|카자흐스탄|키르기스스탄/u.test(hay)
}

async function evaluateProduct(p: ProductRow): Promise<{
  summary: RegisterMegaMenuGeoSummary
  countryTagKeys: string[]
  cityKeys: string[]
  primaryCity: string | null
}> {
  const cityKeys = p.cityTags.map((t) => t.cityKey)
  const primaryCity = p.cityTags.find((t) => t.isPrimary)?.cityKey ?? cityKeys[0] ?? p.cityKey
  const summary = buildRegisterMegaMenuGeoSummary({
    geo: {
      countryKey: p.countryKey,
      cityKey: p.cityKey,
      nodeKey: p.nodeKey,
      groupKey: p.groupKey,
      continent: null,
      continentKey: null,
      country: null,
      city: null,
      locationMatchConfidence: null,
      locationMatchSource: null,
    },
    cityKeys,
    countryTagKeys: p.countryTags.map((t) => t.countryKey),
    tagOpts: {
      title: p.title ?? '',
      primaryDestination: p.primaryDestination,
      destinationRaw: p.destinationRaw,
      scheduleHaystack: scheduleHaystack(p.schedule),
    },
  })
  return {
    summary,
    countryTagKeys: p.countryTags.map((t) => t.countryKey),
    cityKeys,
    primaryCity: primaryCity ?? null,
  }
}

async function healLatinCaribbeanProduct(p: ProductRow): Promise<ProductRow> {
  // REGRESSION-FREEZE[mega-menu-product-alignment]: prebuild heal latin-caribbean tags — manifest
  const hay = scheduleHaystack(p.schedule)
  await syncProductGeoTags(
    prisma,
    p.id,
    {
      countryKey: p.countryKey,
      cityKey: p.cityKey,
      nodeKey: p.nodeKey,
      groupKey: p.groupKey ?? 'americas',
      continent: null,
      continentKey: null,
      country: null,
      city: null,
      locationMatchConfidence: null,
      locationMatchSource: null,
    },
    {
      title: p.title ?? '',
      primaryDestination: p.primaryDestination,
      destinationRaw: p.destinationRaw,
      scheduleHaystack: hay,
    },
  )
  if (
    (!p.primaryDestination?.trim() || p.primaryDestination.trim() === '미지정') &&
    ((p.countryKey ?? '').trim() === 'latin-caribbean' || (p.nodeKey ?? '').trim() === 'south-america')
  ) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        primaryDestination: '남미',
        destinationRaw:
          !p.destinationRaw?.trim() || p.destinationRaw.trim() === '미지정' ? '남미' : p.destinationRaw,
        groupKey: p.groupKey?.trim() || 'americas',
      },
    })
  }
  const refreshed = await prisma.product.findUniqueOrThrow({
    where: { id: p.id },
    select: {
      id: true,
      slug: true,
      title: true,
      travelScope: true,
      primaryDestination: true,
      destinationRaw: true,
      schedule: true,
      countryKey: true,
      cityKey: true,
      nodeKey: true,
      groupKey: true,
      countryTags: { select: { countryKey: true, nodeKey: true, isPrimary: true } },
      cityTags: { select: { cityKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  console.warn(
    `[verify:mega-menu-product-alignment] healed ${refreshed.slug ?? refreshed.id}: countryTags=${refreshed.countryTags
      .map((t) => t.countryKey)
      .join(',')}`,
  )
  return refreshed
}

async function healCentralAsiaProduct(p: ProductRow): Promise<ProductRow> {
  // REGRESSION-FREEZE[mega-menu-product-alignment]: prebuild heal central-asia tags — manifest
  const hay = scheduleHaystack(p.schedule)
  const dest = isHashtagNoiseDestination(p.primaryDestination)
    ? '중앙아시아'
    : (p.primaryDestination ?? '중앙아시아')
  const destRaw = isHashtagNoiseDestination(p.destinationRaw) ? dest : (p.destinationRaw ?? dest)
  await prisma.product.update({
    where: { id: p.id },
    data: {
      primaryDestination: dest,
      destinationRaw: destRaw,
      countryKey: (p.countryKey ?? '').trim() || 'central-asia',
      groupKey: 'china-circle',
    },
  })
  await syncProductGeoTags(
    prisma,
    p.id,
    {
      countryKey: 'central-asia',
      cityKey: p.cityKey,
      nodeKey: p.nodeKey,
      groupKey: 'china-circle',
      continent: null,
      continentKey: null,
      country: null,
      city: null,
      locationMatchConfidence: null,
      locationMatchSource: null,
    },
    {
      title: p.title ?? '',
      primaryDestination: dest,
      destinationRaw: destRaw,
      scheduleHaystack: hay,
    },
  )
  const refreshed = await prisma.product.findUniqueOrThrow({
    where: { id: p.id },
    select: {
      id: true,
      slug: true,
      title: true,
      travelScope: true,
      primaryDestination: true,
      destinationRaw: true,
      schedule: true,
      countryKey: true,
      cityKey: true,
      nodeKey: true,
      groupKey: true,
      countryTags: { select: { countryKey: true, nodeKey: true, isPrimary: true } },
      cityTags: { select: { cityKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  console.warn(
    `[verify:mega-menu-product-alignment] healed central-asia ${refreshed.slug ?? refreshed.id}: countryTags=${refreshed.countryTags
      .map((t) => t.countryKey)
      .join(',')}`,
  )
  return refreshed
}

async function main(): Promise<void> {
  const issues: Issue[] = []
  const leafChecks: Array<{ regionId: string; subgroup: string; cityLabel: string; cityKey: string; ok: boolean }> =
    []

  const products = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      slug: true,
      title: true,
      travelScope: true,
      primaryDestination: true,
      destinationRaw: true,
      schedule: true,
      countryKey: true,
      cityKey: true,
      nodeKey: true,
      groupKey: true,
      countryTags: { select: { countryKey: true, nodeKey: true, isPrimary: true } },
      cityTags: { select: { cityKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { slug: 'asc' },
  })

  let overseas = 0
  let aligned = 0

  for (let p of products) {
    if (parseTravelScope(p.travelScope ?? undefined) === 'domestic') continue
    overseas++

    let evaluated = await evaluateProduct(p)
    if (
      megaMenuSummaryNeedsOperatorReview(evaluated.summary, {
        countryTagKeys: evaluated.countryTagKeys,
      }) &&
      shouldHealLatinCaribbeanCluster(p)
    ) {
      p = await healLatinCaribbeanProduct(p)
      evaluated = await evaluateProduct(p)
    }
    if (
      megaMenuSummaryNeedsOperatorReview(evaluated.summary, {
        countryTagKeys: evaluated.countryTagKeys,
      }) &&
      shouldHealCentralAsiaCluster(p)
    ) {
      p = await healCentralAsiaProduct(p)
      evaluated = await evaluateProduct(p)
    }

    const { summary, countryTagKeys: countryTagKeysFromDb, cityKeys, primaryCity } = evaluated

    if (megaMenuSummaryNeedsOperatorReview(summary, { countryTagKeys: countryTagKeysFromDb })) {
      issues.push({
        slug: p.slug ?? p.id,
        kind: 'mega_menu_summary_gap',
        detail: summary.warnings.join('; ') || 'browseRegionTab/subgroup missing',
      })
      continue
    }

    const placement = primaryCity ? megaMenuPlacementForCityKey(primaryCity) : null
    if (
      summary.browseRegionTab &&
      placement &&
      placement.regionId !== summary.browseRegionTab
    ) {
      issues.push({
        slug: p.slug ?? p.id,
        kind: 'city_placement_region_mismatch',
        detail: `summary region=${summary.browseRegionTab} city ${primaryCity} placement=${placement.regionId}`,
      })
      continue
    }

    const href =
      placement && summary.browseRegionTab
        ? (() => {
            const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === placement.regionId)
            const group = region?.countryGroups?.find(
              (g) => countrySlugFromLabel(g.countryLabel) === placement.menuGroupSlug,
            )
            if (!group) return null
            if (primaryCity) {
              for (const leaf of group.cities) {
                const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
                if (leaf.kind === 'city' && slug === primaryCity) {
                  return buildMegaMenuLeafHref({
                    type: 'travel',
                    regionId: placement.regionId,
                    countryLabel: group.countryLabel,
                    headerBrowseCountryLabel: group.headerBrowseCountryLabel,
                    leaf,
                  })
                }
              }
            }
            return buildProductsHrefCountryOnly({
              type: 'travel',
              regionId: placement.regionId,
              countryLabel: group.countryLabel,
              headerBrowseCountryLabel: group.headerBrowseCountryLabel,
            })
          })()
        : null
    if (href) {
      const u = new URL(href, 'http://localhost')
      const geo = await buildOverseasBrowseGeoResolution({
        region: u.searchParams.get('region'),
        country: u.searchParams.get('country'),
        city: u.searchParams.get('city'),
        menuGroup: u.searchParams.get('menuGroup'),
      })
      const matches = productMatchesBrowseUrlGeo(
        {
          title: p.title ?? '',
          originSource: '',
          primaryDestination: p.primaryDestination,
          destinationRaw: p.destinationRaw,
          countryKey: p.countryKey,
          cityKey: p.cityKey,
          nodeKey: p.nodeKey,
          cityTags: cityKeys.map((cityKey) => ({ cityKey })),
          countryTags: p.countryTags.map((t) => ({
            countryKey: t.countryKey,
            nodeKey: t.nodeKey,
            isPrimary: t.isPrimary,
          })),
        },
        geo,
      )
      if (!matches) {
        issues.push({
          slug: p.slug ?? p.id,
          kind: 'browse_url_mismatch',
          detail: href,
        })
        continue
      }
    }

    aligned++
  }

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture || !tab.groups.length) continue
    if (!isMegaMenuRegionCityGroupTabId(tab.id)) continue
    const subgroups = megaMenuSubgroupLabelsInOrder(tab.id)
    for (const group of tab.groups) {
      if (!subgroups.includes(group.countryLabel)) continue
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const cityKey = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        const placement = megaMenuPlacementForCityKey(cityKey)
        const ok =
          placement?.regionId === tab.id &&
          placement.menuGroupSlug === countrySlugFromLabel(group.countryLabel)
        leafChecks.push({
          regionId: tab.id,
          subgroup: group.countryLabel,
          cityLabel: leaf.label,
          cityKey,
          ok,
        })
        if (!ok) {
          issues.push({
            slug: `leaf:${tab.id}/${group.countryLabel}/${leaf.label}`,
            kind: 'menu_leaf_placement',
            detail: `cityKey=${cityKey} placement=${JSON.stringify(placement)}`,
          })
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        overseasProducts: overseas,
        aligned,
        issueCount: issues.length,
        leafChecks: leafChecks.length,
        leafOk: leafChecks.filter((x) => x.ok).length,
        sampleIssues: issues.slice(0, 25),
      },
      null,
      2,
    ),
  )

  if (issues.length > 0) {
    console.error(`\n[verify:mega-menu-product-alignment] ${issues.length} issue(s)`)
    process.exit(1)
  }
  console.log('\n[verify:mega-menu-product-alignment] OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
