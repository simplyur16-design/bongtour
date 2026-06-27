/**
 * browse 풀 vs DB 등록 상품 격차 진단.
 * npx tsx scripts/diagnose-browse-pool-gap.ts
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

import { PrismaClient } from '@prisma/client'
import { filterProductsForOverseasDestinationTree } from '@/lib/active-overseas-location-tree'
import { triageProductTitleForPickTab } from '@/lib/gallery-product-triage'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { isAirHotelProduct } from '@/lib/air-hotel-product-ssot'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'
import {
  isMegaMenuRegionCityGroupTabId,
  resolveOverseasMegaMenuSubgroupLabelForBrowse,
} from '@/lib/overseas-mega-region-city-group'
import { resolveOverseasCountryRowLabelForBrowse } from '@/lib/overseas-display-buckets'

type Row = {
  id: string
  title: string
  slug: string | null
  originCode: string | null
  listingKind: string | null
  productType: string | null
  travelScope: string | null
  registrationStatus: string
  countryTags: { countryKey: string; nodeKey: string | null }[]
  cityTags: { cityKey: string }[]
}

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })
  const all = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      originCode: true,
      listingKind: true,
      productType: true,
      travelScope: true,
      registrationStatus: true,
      countryTags: { select: { countryKey: true, nodeKey: true } },
      cityTags: { select: { cityKey: true } },
    },
  })

  const registered = all.filter((p) => p.registrationStatus === 'registered')
  const training = registered.filter((p) => p.listingKind === OVERSEAS_TRAINING_LISTING_KIND)
  const travelPool = registered.filter((p) => p.listingKind !== OVERSEAS_TRAINING_LISTING_KIND)

  console.log('=== DB counts ===')
  console.log('all products:', all.length)
  console.log('registered:', registered.length)
  console.log('registered training programs:', training.length)
  console.log('registered travel (excl training):', travelPool.length)

  const notRegistered = all.filter((p) => p.registrationStatus !== 'registered')
  const regByStatus = new Map<string, number>()
  for (const p of all) {
    regByStatus.set(p.registrationStatus, (regByStatus.get(p.registrationStatus) ?? 0) + 1)
  }
  console.log('\n=== registrationStatus breakdown (all 272) ===')
  for (const [k, v] of [...regByStatus.entries()].sort()) console.log(`  ${k}: ${v}`)
  console.log('not registered (excl from browse):', notRegistered.length)
  if (notRegistered.length > 0) {
    const byKind = new Map<string, number>()
    for (const p of notRegistered) {
      const k = p.listingKind ?? '(null)'
      byKind.set(k, (byKind.get(k) ?? 0) + 1)
    }
    console.log('  by listingKind:', Object.fromEntries(byKind))
  }

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND },
      ...publicProductWhereClause(),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      originCode: true,
      listingKind: true,
      productType: true,
      travelScope: true,
      registrationStatus: true,
      countryTags: { select: { countryKey: true, nodeKey: true } },
      cityTags: { select: { cityKey: true } },
    },
  })

  const overseasTree = filterProductsForOverseasDestinationTree(rows)

  const inNeither = rows.filter((p) => {
    const inO = overseasTree.some((x) => x.id === p.id)
    return !inO
  })

  console.log('\n=== tree filter (no browse slice) ===')
  console.log('overseas tree pool:', overseasTree.length)
  console.log('in neither tree:', inNeither.length)

  const noCountryTag = rows.filter((p) => p.countryTags.length === 0)
  const noCityTag = rows.filter((p) => p.cityTags.length === 0)
  const noGeoTag = rows.filter((p) => p.countryTags.length === 0 && p.cityTags.length === 0)
  const noTreeMatch = rows.filter((p) => !matchProductToOverseasNode(p))

  console.log('\n=== geo tag coverage (travel pool) ===')
  console.log('no ProductCountryTag:', noCountryTag.length)
  console.log('no ProductCityTag:', noCityTag.length)
  console.log('no country+city tags:', noGeoTag.length)
  console.log('matchProductToOverseasNode null:', noTreeMatch.length)

  if (inNeither.length > 0) {
    console.log('\n=== in neither tree (sample up to 15) ===')
    for (const p of inNeither.slice(0, 15)) {
      const ts = parseTravelScope(p.travelScope ?? undefined)
      const tab = triageProductTitleForPickTab(p.title)
      console.log(
        `- ${p.slug ?? p.originCode ?? p.id} | ts=${ts ?? 'null'} | triage=${tab} | tags=${p.countryTags.length}/${p.cityTags.length} | ${p.title.slice(0, 60)}`,
      )
    }
  }

  if (noGeoTag.length > 0) {
    console.log('\n=== no geo tags (sample up to 15) ===')
    for (const p of noGeoTag.slice(0, 15)) {
      const m = matchProductToOverseasNode(p)
      const tab = m ? continentTabIdForMatch(m.groupKey, m.countryKey) : '—'
      console.log(
        `- ${p.slug ?? p.originCode ?? p.id} | treeTab=${tab} | ts=${p.travelScope ?? 'null'} | ${p.title.slice(0, 60)}`,
      )
    }
  }

  const airHotel = rows.filter((p) => isAirHotelProduct(p))
  const privateTrip = rows.filter((p) => p.listingKind === 'private_trip')
  const tsDomestic = rows.filter((p) => parseTravelScope(p.travelScope ?? undefined) === 'domestic')
  const tsOverseas = rows.filter((p) => parseTravelScope(p.travelScope ?? undefined) === 'overseas')
  const tsNull = rows.filter((p) => parseTravelScope(p.travelScope ?? undefined) == null)

  console.log('\n=== listingKind / travelScope breakdown ===')
  console.log('air-hotel products:', airHotel.length)
  console.log('private_trip:', privateTrip.length)
  console.log('travelScope=domestic:', tsDomestic.length)
  console.log('travelScope=overseas:', tsOverseas.length)
  console.log('travelScope unset:', tsNull.length)

  const weakTree = rows.filter((p) => !matchProductToOverseasNode(p))
  if (weakTree.length > 0) {
    console.log('\n=== tree match null but registered (sample) ===')
    for (const p of weakTree.slice(0, 10)) {
      console.log(
        `- ${p.slug ?? p.originCode} | countryTags=${p.countryTags.map((t) => t.countryKey).join(',')} | cityTags=${p.cityTags.map((t) => t.cityKey).join(',')} | ${p.title.slice(0, 55)}`,
      )
    }
  }

  let noSubgroup = 0
  const noSubgroupSamples: string[] = []
  for (const p of rows) {
    const match = matchProductToOverseasNode(p)
    const countryRowLabel = resolveOverseasCountryRowLabelForBrowse(p, match)
    for (const tab of [
      'japan',
      'china-hk-mo',
      'southeast-asia',
      'oceania',
      'americas',
      'south-america',
      'europe-me',
    ] as const) {
      if (!isMegaMenuRegionCityGroupTabId(tab)) continue
      const sub = resolveOverseasMegaMenuSubgroupLabelForBrowse(p, match, tab, countryRowLabel)
      if (!sub) {
        noSubgroup++
        if (noSubgroupSamples.length < 8) {
          noSubgroupSamples.push(`${tab} | ${p.slug ?? p.originCode} | ${p.title.slice(0, 40)}`)
        }
      }
    }
  }
  console.log('\n=== mega menu subgroup (7 tabs × 216 products) ===')
  console.log('missing subgroup label slots:', noSubgroup, '(multi-tab; one product can miss multiple)')
  if (noSubgroupSamples.length) {
    console.log('samples:')
    for (const s of noSubgroupSamples) console.log(' ', s)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
