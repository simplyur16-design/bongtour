/**
 * 메가메뉴 SSOT ↔ browse 탭 매핑 검증 (A–I).
 * npx tsx scripts/verify-mega-menu-ssot-browse.ts
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
  }) => Promise<import('@/lib/browse-master-geo').OverseasBrowseGeoResolution>
  scoreAndFilterProducts: typeof import('@/lib/products-browse-filter').scoreAndFilterProducts
  publicProductWhereClause: typeof import('@/lib/product-sales-policy').publicProductWhereClause
  filterProductsForOverseasDestinationTree: typeof import('@/lib/active-overseas-location-tree').filterProductsForOverseasDestinationTree
}

async function countBrowse(
  deps: BrowseDeps,
  q: { region: string | null; country: string | null; city: string | null },
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
    urlGeo: { ...q, regionCountryKeys: geo.regionCountryKeys },
  })
  return { n: scored.length, geo }
}

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const { MEGA_MENU_TAB_DEFINITIONS } = await import('@/lib/mega-menu-regions.data')
  const { BROWSE_TAB_ID_TO_CARD_KEYS, browseTabIdToMegaMenuCardKeys } = await import(
    '@/lib/browse-master-geo-continents'
  )
  const geoMod = await import('@/lib/browse-master-geo')
  const buildOverseasBrowseGeoResolution = geoMod.buildOverseasBrowseGeoResolution
  if (typeof buildOverseasBrowseGeoResolution !== 'function') {
    throw new Error(`buildOverseasBrowseGeoResolution missing (keys: ${Object.keys(geoMod).join(',')})`)
  }
  const { buildMegaMenuLeafHref } = await import('@/lib/top-nav-resolve')
  const { OVERSEAS_MEGA_MENU_REGIONS } = await import('@/lib/travel-landing-mega-menu-data')
  const { scoreAndFilterProducts } = await import('@/lib/products-browse-filter')
  const { publicProductWhereClause } = await import('@/lib/product-sales-policy')
  const { filterProductsForOverseasDestinationTree } = await import('@/lib/active-overseas-location-tree')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const deps = {
    prisma,
    buildOverseasBrowseGeoResolution,
    scoreAndFilterProducts,
    publicProductWhereClause,
    filterProductsForOverseasDestinationTree,
  }

  let failed = false
  try {
    console.log('[SSOT tabs]', MEGA_MENU_TAB_DEFINITIONS.map((t) => `${t.id} (${t.label})`).join(' | '))
    console.log('[card map]', JSON.stringify(BROWSE_TAB_ID_TO_CARD_KEYS, null, 0))

    const tabCases = [
      { id: 'A', region: 'japan', min: 29 },
      { id: 'B', region: 'china-hk-mo', min: 1 },
      { id: 'C', region: 'americas', min: 1 },
      { id: 'D', region: 'europe-me', min: 1 },
      { id: 'E', region: 'southeast-asia', min: 1 },
      { id: 'F', region: 'busan_dep', min: 5, local: 'busan' },
      { id: 'G', region: 'cheongju_dep', min: 12, local: 'cheongju' },
      { id: 'H', region: 'daegu_dep', min: 15, local: 'daegu' },
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
      const { n } = await countBrowse(deps, {
        region: c.region,
        country: null,
        city: null,
      })
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
        leaf,
      })
    }

    function parseHref(href: string) {
      const u = new URL(href, 'http://localhost')
      return {
        region: u.searchParams.get('region'),
        country: u.searchParams.get('country'),
        city: u.searchParams.get('city'),
      }
    }

    const leafCases = [
      { id: 'I-tokyo', q: { region: 'japan', country: 'japan', city: 'tokyo' }, min: 3 },
      {
        id: 'I-danang',
        q: { region: 'southeast-asia', country: 'vietnam', city: 'danang' },
        min: 6,
      },
      {
        id: 'I-bangkok',
        q: { region: 'southeast-asia', country: 'thailand', city: 'bangkok' },
        min: 1,
      },
      {
        id: 'I-shanghai',
        q: { region: 'china-hk-mo', country: 'china', city: 'shanghai' },
        min: 3,
      },
      {
        id: 'I-denmark',
        href: leafHref('europe-me', '북유럽', '덴마크'),
        min: 4,
      },
    ]

    for (const c of leafCases) {
      const q = 'q' in c ? c.q! : parseHref(c.href!)
      const { n } = await countBrowse(deps, q)
      if (n < c.min) {
        console.error(`[FAIL] ${c.id}: ${n} < ${c.min}`, q)
        failed = true
      } else console.log(`[ok] ${c.id}: ${n}`, q)
    }

    const jpGroups = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'japan')?.countryGroups ?? []
    const jpGroupLabels = jpGroups.map((g) => g.countryLabel)
    const dbCards = await prisma.megaMenuGroupCard.findMany({
      where: { isActive: true, continentKey: 'northeast-asia' },
      select: { cardKey: true, koreanLabel: true },
    })
    const japanSubCards = dbCards.filter((c) => c.cardKey.startsWith('japan-'))
    console.log('\n[audit] JP SSOT groups:', jpGroupLabels.join(', '))
    console.log('[audit] JP DB sub-cards:', japanSubCards.map((c) => c.cardKey).join(', '))
    const unmapped = jpGroupLabels.filter(
      (label) =>
        !japanSubCards.some((c) => c.koreanLabel.includes(label) || c.cardKey.includes(label.replace(/-/g, ''))),
    )
    if (unmapped.length) {
      console.log('[audit] JP groups without dedicated DB card (SSOT-only headers):', unmapped.join(', '))
    }

    const cnGroups = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'china-hk-mo')?.countryGroups ?? []
    console.log('[audit] CN SSOT groups:', cnGroups.map((g) => g.countryLabel).join(', '))
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
