/**
 * 메가메뉴·browse SSOT 통합 검증 (탭/leaf 카운트 + 정적 URL + 태그 일치).
 * npx tsx scripts/verify-mega-menu-ssot-browse.ts
 *
 * (구) verify-mega-menu-browse-urls.ts · verify-browse-country-tag-geo.ts 기능 포함.
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

type BrowseDeps = {
  prisma: import('@prisma/client').PrismaClient
  buildOverseasBrowseGeoResolution: (q: {
    region: string | null
    country: string | null
    city: string | null
    menuGroup?: string | null
  }) => Promise<import('@/lib/browse-master-geo').OverseasBrowseGeoResolution>
  scoreAndFilterProducts: typeof import('@/lib/products-browse-filter').scoreAndFilterProducts
  publicProductWhereClause: typeof import('@/lib/product-sales-policy').publicProductWhereClause
  filterProductsForOverseasDestinationTree: typeof import('@/lib/active-overseas-location-tree').filterProductsForOverseasDestinationTree
}

/** browse API와 동일: Prisma 태그 where + travelScope 풀만 (메모리 geo 재필터 없음) */
async function countBrowse(
  deps: BrowseDeps,
  q: {
    region: string | null
    country: string | null
    city: string | null
    menuGroup?: string | null
  },
) {
  const geo = await deps.buildOverseasBrowseGeoResolution(q)
  const rows = await deps.prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      AND: [...geo.whereClauses, deps.publicProductWhereClause()],
    },
    include: { countryTags: true, cityTags: true, departures: true },
  })
  const pool = deps.filterProductsForOverseasDestinationTree(rows)
  const scored = deps.scoreAndFilterProducts(pool, {
    type: null,
    destinationTerms: [],
    budgetPerPersonMax: null,
    sort: 'popular',
    urlGeo: undefined,
  })
  return { n: scored.length, geo }
}

function parseBrowseHref(href: string) {
  const u = new URL(href, 'http://localhost')
  return {
    region: u.searchParams.get('region'),
    country: u.searchParams.get('country'),
    city: u.searchParams.get('city'),
    menuGroup: u.searchParams.get('menuGroup'),
  }
}

async function verifyMegaMenuBrowseUrls(
  intersectBrowseCountryKeys: (
    cardCountryKeys: string[],
    countryParam: string | null | undefined,
  ) => string[],
  resolveBrowseRegionToCountryKeys: (region: string | null | undefined) => Promise<string[]>,
): Promise<void> {
  const {
    TOP_NAV_MEGA_REGIONS,
    buildMegaMenuLeafHref,
    buildProductsHrefCountryOnly,
    countrySlugForMegaMenuCityHref,
    countrySlugFromLabel,
  } = await import('@/lib/top-nav-resolve')
  const {
    BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE,
    resolveBrowseCityKeysForFilter,
    resolveBrowseCountryParamToCountryKeySlugs,
    resolveBrowseCountryParamToDbCountries,
  } = await import('@/lib/browse-country-url-resolve')

  const BROWSE_TYPE = 'travel' as const
  const issues: string[] = []

  /** href country 버그 회귀 — 핵심 슬러그만 탭 카드 countryKey 교집합 검사 */
  const REGRESSION_INTERSECT_COUNTRY_SLUGS = new Set([
    'japan',
    'vietnam',
    'thailand',
    'china',
    'denmark',
    'italy',
    'france',
    'spain',
    'switzerland',
    'germany',
    'netherlands',
    'belgium',
    'austria',
    'greece',
    'turkey',
    'egypt',
    'morocco',
    'singapore',
    'malaysia',
    'indonesia',
    'philippines',
    'taiwan',
    'guam',
    'saipan',
    'australia',
    'new-zealand',
    'maldives',
    'mongolia',
    'macau',
    'hong-kong',
  ])

  async function assertRegressionCountrySlugIntersectsRegion(
    regionId: string,
    countrySlug: string,
    ctx: string,
  ) {
    if (!REGRESSION_INTERSECT_COUNTRY_SLUGS.has(countrySlug)) return
    if (BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE.has(countrySlug)) return
    const regionKeys = await resolveBrowseRegionToCountryKeys(regionId)
    const hit = intersectBrowseCountryKeys(regionKeys, countrySlug)
    if (hit.length === 0) {
      issues.push(`${ctx} region=${regionId} country=${countrySlug} ∩ tab keys = ∅`)
    }
  }

  for (const region of TOP_NAV_MEGA_REGIONS) {
    for (const g of region.countryGroups ?? []) {
      if (!g.nonLinkHeader) {
        const headerHref = buildProductsHrefCountryOnly({
          type: BROWSE_TYPE,
          regionId: region.id,
          countryLabel: g.countryLabel,
          headerBrowseCountryLabel: g.headerBrowseCountryLabel,
        })
        const headerParsed = parseBrowseHref(headerHref)
        const headerSlug = headerParsed.country?.trim().toLowerCase() ?? ''
        const expectedHeaderSlug = countrySlugFromLabel(g.headerBrowseCountryLabel ?? g.countryLabel)
        const expectedMenuGroup = countrySlugFromLabel(g.countryLabel)
        if (headerSlug !== expectedHeaderSlug) {
          issues.push(
            `[header-slug] region=${region.id} group=${g.countryLabel} got=${headerSlug} want=${expectedHeaderSlug}`,
          )
        }
        const menuGroupSlug = headerParsed.menuGroup?.trim().toLowerCase() ?? ''
        if (menuGroupSlug !== expectedMenuGroup) {
          issues.push(
            `[header-menuGroup] region=${region.id} group=${g.countryLabel} got=${menuGroupSlug} want=${expectedMenuGroup}`,
          )
        }
        const headerOk =
          resolveBrowseCountryParamToCountryKeySlugs(headerSlug).length > 0 ||
          resolveBrowseCountryParamToDbCountries(headerSlug).length > 0
        if (!headerOk && !BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE.has(headerSlug)) {
          issues.push(`[header-resolve] region=${region.id} country=${headerSlug}`)
        }
        if (!headerParsed.menuGroup) {
          await assertRegressionCountrySlugIntersectsRegion(region.id, headerSlug, '[header]')
        }
      }
      for (const leaf of g.cities) {
        const leafHref = buildMegaMenuLeafHref({
          type: BROWSE_TYPE,
          regionId: region.id,
          countryLabel: g.countryLabel,
          headerBrowseCountryLabel: g.headerBrowseCountryLabel,
          leaf,
        })
        const parsed = parseBrowseHref(leafHref)
        if (leaf.kind === 'country') {
          if (parsed.city) {
            issues.push(`[leaf] country-kind must not set city: ${leafHref}`)
          }
          const leafSlug = parsed.country?.trim().toLowerCase() ?? ''
          const countryOk =
            resolveBrowseCountryParamToCountryKeySlugs(leafSlug).length > 0 ||
            resolveBrowseCountryParamToDbCountries(leafSlug).length > 0
          if (!countryOk && !BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE.has(leafSlug)) {
            issues.push(`[leaf] region=${region.id} country=${leafSlug}`)
          }
          await assertRegressionCountrySlugIntersectsRegion(region.id, leafSlug, '[leaf-country]')
        } else {
          const city = (parsed.city ?? '').trim()
          if (!city) {
            issues.push(`[leaf] city-kind missing city: ${leafHref}`)
            continue
          }
          const countrySlug = parsed.country?.trim().toLowerCase() ?? ''
          const expectedCountrySlug = countrySlugForMegaMenuCityHref({
            leaf,
            countryLabel: g.countryLabel,
            headerBrowseCountryLabel: g.headerBrowseCountryLabel,
          })
          if (countrySlug !== expectedCountrySlug) {
            issues.push(
              `[leaf-slug] region=${region.id} city=${city} got country=${countrySlug} want=${expectedCountrySlug} (${leafHref})`,
            )
          }
          const cityAsCountrySlug = countrySlugFromLabel(leaf.label)
          if (
            countrySlug === cityAsCountrySlug &&
            !g.headerBrowseCountryLabel &&
            countrySlugFromLabel(g.countryLabel) !== cityAsCountrySlug
          ) {
            issues.push(
              `[leaf-city-as-country] region=${region.id} leaf=${leaf.label} country=${countrySlug} (${leafHref})`,
            )
          }
          if (resolveBrowseCityKeysForFilter(city).length === 0) {
            issues.push(`[leaf] region=${region.id} city=${city} (no cityKey)`)
          }
          await assertRegressionCountrySlugIntersectsRegion(
            region.id,
            countrySlug,
            `[leaf-city] ${city}`,
          )
        }
      }
    }
  }

  const fr = resolveBrowseCountryParamToDbCountries('france')
  if (fr.length !== 1 || fr[0] !== '프랑스') {
    issues.push(`[check] france → ${JSON.stringify(fr)}`)
  }

  const { resolveMegaMenuGroupCountryKeySlugs } = await import('@/lib/mega-menu-browse-group')
  const easternMenuGroupKeys = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'eastern-europe')
  for (const want of ['czech', 'hungary', 'poland']) {
    if (!easternMenuGroupKeys.includes(want)) {
      issues.push(
        `[eastern-europe-menuGroup] missing ${want} got=${JSON.stringify(easternMenuGroupKeys)}`,
      )
    }
  }
  if (easternMenuGroupKeys.length === 1 && easternMenuGroupKeys[0] === 'poland') {
    issues.push('[eastern-europe-menuGroup] regressed to poland-only resolution')
  }

  if (issues.length) {
    console.error('[FAIL] static mega-menu URL resolve:', issues.length)
    for (const x of issues) console.error(`  ${x}`)
    process.exit(1)
  }
  console.log('[ok] static mega-menu country slugs resolve (+ region ∩ country)')
}

async function verifyTagGeoConsistency(prisma: import('@prisma/client').PrismaClient): Promise<void> {
  const { buildOverseasBrowseGeoResolution, resolveBrowseCardKeyToCountryKeys } = await import(
    '@/lib/browse-master-geo'
  )
  const { productMatchesBrowseUrlGeo } = await import('@/lib/match-overseas-product')
  const { publicProductWhereClause } = await import('@/lib/product-sales-policy')

  async function assertPrismaMatchesMemory(query: {
    region?: string
    country?: string
    city?: string
    menuGroup?: string | null
  }) {
    const geo = await buildOverseasBrowseGeoResolution({
      region: query.region ?? null,
      country: query.country ?? null,
      city: query.city ?? null,
      menuGroup: query.menuGroup ?? null,
    })
    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        AND: [...geo.whereClauses, publicProductWhereClause()],
      },
      select: { slug: true, originCode: true, countryTags: true, cityTags: true },
    })
    const drift = rows.filter(
      (p) =>
        !productMatchesBrowseUrlGeo(
          { title: '', originSource: '', countryTags: p.countryTags, cityTags: p.cityTags },
          {
            region: query.region ?? null,
            country: query.country ?? null,
            city: query.city ?? null,
            regionCountryKeys: geo.regionCountryKeys,
          },
        ),
    )
    if (drift.length > 0) {
      throw new Error(
        `Prisma/memory drift ${JSON.stringify(query)}: ${drift
          .slice(0, 3)
          .map((p) => p.slug ?? p.originCode)
          .join(', ')}`,
      )
    }
    return rows.length
  }

  const c1 = await assertPrismaMatchesMemory({ region: 'nordic-baltic-cluster', country: 'denmark' })
  console.log(`[ok] tag drift check nordic+denmark: ${c1}건`)

  const c2 = await assertPrismaMatchesMemory({ region: 'japan', city: 'tokyo' })
  if (c2 < 3) throw new Error(`japan+tokyo expected >=3, got ${c2}`)
  console.log(`[ok] tag drift check japan+tokyo: ${c2}건`)

  const easternHeaderQ = {
    region: 'europe-me',
    country: 'eastern-europe',
    city: null as string | null,
    menuGroup: 'eastern-europe',
  }
  const c3 = await assertPrismaMatchesMemory(easternHeaderQ)
  console.log(`[ok] tag drift check europe-me+eastern-europe menuGroup: ${c3}건`)

  const denmarkKeys = await resolveBrowseCardKeyToCountryKeys('nordic-baltic-cluster')
  if (!denmarkKeys.includes('denmark')) {
    throw new Error('nordic-baltic-cluster card missing denmark')
  }
  console.log('[ok] nordic-baltic-cluster card includes denmark')
}

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const { MEGA_MENU_TAB_DEFINITIONS, BROWSE_TAB_ID_TO_CARD_KEYS } = await import(
    '@/lib/mega-menu-regions.data'
  )
  const { browseTabIdToMegaMenuCardKeys } = await import('@/lib/browse-master-geo-continents')
  const geoMod = await import('@/lib/browse-master-geo')
  const buildOverseasBrowseGeoResolution = geoMod.buildOverseasBrowseGeoResolution
  const intersectBrowseCountryKeys = geoMod.intersectBrowseCountryKeys
  const resolveBrowseRegionToCountryKeys = geoMod.resolveBrowseRegionToCountryKeys
  const { buildMegaMenuLeafHref, buildProductsHrefCountryOnly } = await import('@/lib/top-nav-resolve')
  const { OVERSEAS_MEGA_MENU_REGIONS } = await import('@/lib/travel-landing-mega-menu-data')
  const { scoreAndFilterProducts } = await import('@/lib/products-browse-filter')
  const { publicProductWhereClause } = await import('@/lib/product-sales-policy')
  const { filterProductsForOverseasDestinationTree } = await import('@/lib/active-overseas-location-tree')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const deps: BrowseDeps = {
    prisma,
    buildOverseasBrowseGeoResolution,
    scoreAndFilterProducts,
    publicProductWhereClause,
    filterProductsForOverseasDestinationTree,
  }

  let failed = false
  try {
    await verifyMegaMenuBrowseUrls(intersectBrowseCountryKeys, resolveBrowseRegionToCountryKeys)
    await verifyTagGeoConsistency(prisma)

    console.log('[SSOT tabs]', MEGA_MENU_TAB_DEFINITIONS.map((t) => `${t.id} (${t.label})`).join(' | '))
    console.log('[card map]', JSON.stringify(BROWSE_TAB_ID_TO_CARD_KEYS, null, 0))

    const { browseTabIdToMegaMenuCardKeys } = await import('@/lib/browse-master-geo-continents')
    const saCards = browseTabIdToMegaMenuCardKeys('south-america')
    const amCards = browseTabIdToMegaMenuCardKeys('americas')
    if (!saCards.includes('latin-caribbean-cluster')) {
      console.error('[FAIL] south-america tab must map to latin-caribbean-cluster', saCards)
      failed = true
    } else console.log('[ok] south-america card map → latin-caribbean-cluster')
    if (!amCards.includes('americas') || amCards.includes('latin-caribbean-cluster')) {
      console.error('[FAIL] americas tab must map to americas card only', amCards)
      failed = true
    } else console.log('[ok] americas card map → americas only')

    const saCountryKeys = await resolveBrowseRegionToCountryKeys('south-america')
    const latinMasterKeys = [
      'mexico',
      'cuba',
      'peru',
      'brazil',
      'argentina',
      'chile',
      'bolivia',
      'dominican-republic',
    ] as const
    for (const k of latinMasterKeys) {
      if (!saCountryKeys.includes(k)) {
        console.error(`[FAIL] south-america region missing countryKey ${k}`, saCountryKeys)
        failed = true
      }
    }
    if (!failed) console.log('[ok] south-america region includes latin 8 countries')

    const tabCases = [
      { id: 'A-japan', region: 'japan', min: 28 },
      { id: 'B-china', region: 'china-hk-mo', min: 26 },
      { id: 'C-americas', region: 'americas', min: 1 },
      { id: 'J-south-america', region: 'south-america', min: 1 },
      { id: 'D-europe', region: 'europe-me', min: 25 },
      { id: 'E-sea', region: 'southeast-asia', min: 43 },
      { id: 'F-oceania', region: 'oceania', min: 5 },
      { id: 'G-busan', region: 'busan_dep', min: 5, local: 'busan' as const },
      { id: 'H-cheongju', region: 'cheongju_dep', min: 12, local: 'cheongju' as const },
      { id: 'I-daegu', region: 'daegu_dep', min: 15, local: 'daegu' as const },
    ]

    for (const c of tabCases) {
      if (c.local) {
        const n = await prisma.product.count({
          where: {
            registrationStatus: 'registered',
            localDepartureTag: { has: c.local },
            AND: [publicProductWhereClause()],
          },
        })
        if (n < c.min) {
          console.error(`[FAIL] ${c.id} ${c.region}: ${n} < ${c.min}`)
          failed = true
        } else console.log(`[ok] ${c.id} ${c.region}: ${n}`)
        continue
      }
      const { n } = await countBrowse(deps, { region: c.region, country: null, city: null })
      if (n < c.min) {
        console.error(`[FAIL] ${c.id} tab ${c.region}: ${n} < ${c.min}`)
        failed = true
      } else console.log(`[ok] ${c.id} tab ${c.region}: ${n}`)
    }

    function leafHref(regionId: string, groupLabel: string, leafLabel: string): string {
      const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === regionId)
      const g = region?.countryGroups?.find((x) => x.countryLabel === groupLabel)
      const leaf = g?.cities.find((x) => x.label === leafLabel)
      if (!leaf) throw new Error(`leaf ${regionId}/${groupLabel}/${leafLabel}`)
      return buildMegaMenuLeafHref({
        type: 'travel',
        regionId,
        countryLabel: groupLabel,
        headerBrowseCountryLabel: g.headerBrowseCountryLabel,
        leaf,
      })
    }

    function headerHref(regionId: string, groupLabel: string): string {
      const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === regionId)
      const g = region?.countryGroups?.find((x) => x.countryLabel === groupLabel)
      if (!g) throw new Error(`group ${regionId}/${groupLabel}`)
      return buildProductsHrefCountryOnly({
        type: 'travel',
        regionId,
        countryLabel: g.countryLabel,
        headerBrowseCountryLabel: g.headerBrowseCountryLabel,
      })
    }

    const hrefCases = [
      { id: 'I-tokyo', href: leafHref('japan', '간토', '도쿄'), min: 5 },
      { id: 'I-danang', href: leafHref('southeast-asia', '베트남', '다낭'), min: 7 },
      { id: 'I-bangkok', href: leafHref('southeast-asia', '태국', '방콕'), min: 3 },
      { id: 'I-shanghai', href: leafHref('china-hk-mo', '화동', '상해'), min: 3 },
      { id: 'I-denmark', href: leafHref('europe-me', '북유럽', '덴마크'), min: 3 },
      { id: 'C-hokkaido-header', href: headerHref('japan', '홋카이도'), min: 1 },
      { id: 'C-shandong-header', href: headerHref('china-hk-mo', '산동'), min: 1 },
      { id: 'C-us-west-header', href: headerHref('americas', '미서부'), min: 1 },
      { id: 'J-mexico-sa', href: leafHref('south-america', '중남미', '멕시코'), min: 1 },
      { id: 'C-vietnam-header', href: headerHref('southeast-asia', '베트남'), min: 1 },
      { id: 'C-eastern-europe-header', href: headerHref('europe-me', '동유럽'), min: 1 },
    ]

    for (const c of hrefCases) {
      const q = parseBrowseHref(c.href)
      const { n } = await countBrowse(deps, q)
      if (n < c.min) {
        console.error(`[FAIL] ${c.id}: ${n} < ${c.min}`, q, c.href)
        failed = true
      } else console.log(`[ok] ${c.id}: ${n}`, q)
    }

    const japanAll = await countBrowse(deps, { region: 'japan', country: 'japan', city: null, menuGroup: null })
    const hokkaidoOnly = await countBrowse(deps, parseBrowseHref(headerHref('japan', '홋카이도')))
    if (hokkaidoOnly.n >= japanAll.n && japanAll.n > 0) {
      console.error(
        `[FAIL] hokkaido menuGroup should narrow japan tab: hokkaido=${hokkaidoOnly.n} japan=${japanAll.n}`,
      )
      failed = true
    } else {
      console.log(`[ok] hokkaido ⊂ japan: ${hokkaidoOnly.n} / ${japanAll.n}`)
    }

    const easternEuropeRegionKeys = await resolveBrowseRegionToCountryKeys('eastern-europe')
    for (const want of ['czech', 'hungary', 'poland']) {
      if (!easternEuropeRegionKeys.includes(want)) {
        console.error(
          `[FAIL] region=eastern-europe missing ${want} got=${easternEuropeRegionKeys.join(',')}`,
        )
        failed = true
      }
    }

    const europeMeTab = await countBrowse(deps, { region: 'europe-me', country: null, city: null, menuGroup: null })
    const easternEuropeOnly = await countBrowse(deps, parseBrowseHref(headerHref('europe-me', '동유럽')))
    if (easternEuropeOnly.n >= europeMeTab.n && europeMeTab.n > 0) {
      console.error(
        `[FAIL] eastern-europe menuGroup should narrow europe-me tab: eastern=${easternEuropeOnly.n} all=${europeMeTab.n}`,
      )
      failed = true
    } else {
      console.log(`[ok] eastern-europe ⊂ europe-me: ${easternEuropeOnly.n} / ${europeMeTab.n}`)
    }

    const missingCityTag = await prisma.product.count({
      where: {
        registrationStatus: 'registered',
        cityKey: { not: null },
        cityTags: { none: {} },
      },
    })
    if (missingCityTag > 0) {
      console.error(
        `[FAIL] registered+cityKey but no ProductCityTag: ${missingCityTag} — run npm run backfill:product-city-tag`,
      )
      failed = true
    } else {
      console.log('[ok] registered products with cityKey all have ProductCityTag')
    }

    const jpGroups = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'japan')?.countryGroups ?? []
    console.log('\n[audit] JP SSOT groups:', jpGroups.map((g) => g.countryLabel).join(', '))
    console.log('[audit] CN tab cards:', browseTabIdToMegaMenuCardKeys('china-hk-mo').join(', '))
  } finally {
    await prisma.$disconnect()
  }

  if (failed) process.exit(1)
  console.log('\nverify-mega-menu-ssot-browse: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
