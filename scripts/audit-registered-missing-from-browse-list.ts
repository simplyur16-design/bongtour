/**
 * 등록(registered) 상품 중 해외 허브 상품리스트(browse 카탈로그)에 없는 건 전수 검사.
 *
 *   npx tsx scripts/audit-registered-missing-from-browse-list.ts
 *   npx tsx scripts/audit-registered-missing-from-browse-list.ts --json
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { productsBrowseBuildPayload } from '../lib/products-browse-build-payload'
import { buildOverseasHubCatalogFetchQueryKey } from '../lib/products-browse-hub-query'
import { filterProductsForOverseasDestinationTree } from '../lib/active-overseas-location-tree'
import { filterPoolByStoredTravelScope } from '../lib/travel-scope-pool-filter'
import { prismaWhereClausesForBrowseListingSlice } from '../lib/products-browse-db-where'
import { prismaWhereForBrowseTravelScope } from '../lib/travel-scope-pool-filter'
import { publicProductWhereClause } from '../lib/product-sales-policy'
import { triageProductTitleForPickTab } from '../lib/gallery-product-triage'
import { parseTravelScope } from '../lib/product-listing-kind'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'

type MissingReason =
  | 'travel_scope_domestic'
  | 'travel_scope_overseas_domestic_hub'
  | 'listing_overseas_training'
  | 'overseas_tree_triage_domestic'
  | 'domestic_tree_excluded'
  | 'unknown_not_in_catalog'

type Row = {
  id: string
  slug: string | null
  originCode: string | null
  title: string
  originSource: string
  supplier: string
  travelScope: string | null
  listingKind: string | null
  productType: string | null
  primaryDestination: string | null
  reasons: MissingReason[]
}

function classifyOverseasMissing(p: {
  travelScope: string | null
  listingKind: string | null
  title: string
}): MissingReason[] {
  const reasons: MissingReason[] = []
  const ts = parseTravelScope(p.travelScope ?? undefined)
  if (p.listingKind === 'overseas_training') reasons.push('listing_overseas_training')
  if (ts === 'domestic') reasons.push('travel_scope_domestic')
  if (ts !== 'overseas') {
    const tab = triageProductTitleForPickTab(p.title)
    if (tab === 'domestic') reasons.push('overseas_tree_triage_domestic')
  }
  if (reasons.length === 0) reasons.push('unknown_not_in_catalog')
  return reasons
}

async function fetchRegisteredPool(scope: 'overseas') {
  const listingSliceWhere = prismaWhereClausesForBrowseListingSlice({
    scope,
    typeParam: null,
    listingKindParsed: null,
    airHotelCategory: false,
  })
  const travelScopeDb = prismaWhereForBrowseTravelScope(scope)
  return prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      AND: [...(travelScopeDb ? [travelScopeDb] : []), ...listingSliceWhere, publicProductWhereClause()],
    },
    select: {
      id: true,
      slug: true,
      originCode: true,
      title: true,
      originSource: true,
      travelScope: true,
      listingKind: true,
      productType: true,
      primaryDestination: true,
      countryKey: true,
      cityKey: true,
      primaryRegion: true,
      destination: true,
      destinationRaw: true,
      country: true,
      city: true,
      continentKey: true,
      nodeKey: true,
      countryTags: { select: { countryKey: true, nodeKey: true } },
      cityTags: { select: { cityKey: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function main() {
  const jsonOut = process.argv.includes('--json')
  const now = new Date()

  const [allRegistered, autoUnpublished, onHold, pending] = await Promise.all([
    prisma.product.count({ where: { registrationStatus: 'registered' } }),
    prisma.product.count({ where: { registrationStatus: 'auto_unpublished' } }),
    prisma.product.count({ where: { registrationStatus: 'on_hold' } }),
    prisma.product.count({
      where: {
        OR: [{ registrationStatus: null }, { registrationStatus: '' }, { registrationStatus: 'pending' }],
      },
    }),
  ])

  const overseasKey = buildOverseasHubCatalogFetchQueryKey()

  const [overseasPayload, overseasDbPool] = await Promise.all([
    productsBrowseBuildPayload(overseasKey),
    fetchRegisteredPool('overseas'),
  ])

  const overseasCatalogIds = new Set(overseasPayload.items.map((it) => it.id))

  const overseasAfterScope = filterPoolByStoredTravelScope(overseasDbPool, 'overseas')
  const overseasAfterTree = filterProductsForOverseasDestinationTree(overseasAfterScope)

  const overseasMissing: Row[] = []
  for (const p of overseasAfterTree) {
    if (overseasCatalogIds.has(p.id)) continue
    overseasMissing.push({
      id: p.id,
      slug: p.slug,
      originCode: p.originCode,
      title: p.title.slice(0, 100),
      originSource: p.originSource,
      supplier: normalizeSupplierOrigin(p.originSource),
      travelScope: p.travelScope,
      listingKind: p.listingKind,
      productType: p.productType,
      primaryDestination: p.primaryDestination,
      reasons: classifyOverseasMissing(p),
    })
  }

  const domesticMissing: Row[] = []

  const registeredNotAuto = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      slug: true,
      originCode: true,
      title: true,
      originSource: true,
      travelScope: true,
      listingKind: true,
      productType: true,
      primaryDestination: true,
    },
  })

  const inNeitherHub = registeredNotAuto.filter((p) => !overseasCatalogIds.has(p.id))

  function countByReason(rows: Row[]): Record<string, number> {
    const acc: Record<string, number> = {}
    for (const r of rows) {
      for (const reason of r.reasons) {
        acc[reason] = (acc[reason] ?? 0) + 1
      }
    }
    return acc
  }

  function countBySupplier(rows: Row[]): Record<string, number> {
    const acc: Record<string, number> = {}
    for (const r of rows) {
      acc[r.supplier] = (acc[r.supplier] ?? 0) + 1
    }
    return acc
  }

  const summary = {
    auditedAt: now.toISOString(),
    registrationCounts: {
      registered: allRegistered,
      auto_unpublished: autoUnpublished,
      on_hold: onHold,
      pending,
    },
    overseasHub: {
      catalogTotal: overseasPayload.total,
      catalogItems: overseasPayload.items.length,
      dbPoolAfterTree: overseasAfterTree.length,
      missingFromCatalog: overseasMissing.length,
      missingByReason: countByReason(overseasMissing),
      missingBySupplier: countBySupplier(overseasMissing),
    },
    registeredInNeitherHub: inNeitherHub.length,
  }

  if (jsonOut) {
    console.log(JSON.stringify({ summary, overseasMissing, inNeitherHub }, null, 2))
    return
  }

  console.log('=== 등록 상품 · 상품리스트(허브 browse) 전수 검사 ===\n')
  console.log(`검사 시각: ${summary.auditedAt}`)
  console.log('\n[등록 상태 집계]')
  console.log(`  registered(수동 등록·노출 대상): ${summary.registrationCounts.registered}`)
  console.log(`  auto_unpublished(자동 비공개·제외): ${summary.registrationCounts.auto_unpublished}`)
  console.log(`  on_hold: ${summary.registrationCounts.on_hold}`)
  console.log(`  pending: ${summary.registrationCounts.pending}`)

  console.log('\n[해외 허브 /travel/overseas 카탈로그]')
  console.log(`  카탈로그 노출: ${summary.overseasHub.catalogItems}건 (total=${summary.overseasHub.catalogTotal})`)
  console.log(`  DB registered 풀(트리 통과): ${summary.overseasHub.dbPoolAfterTree}건`)
  console.log(`  리스트 미노출(registered·트리통과·카탈로그없음): ${summary.overseasHub.missingFromCatalog}건`)
  for (const [k, n] of Object.entries(summary.overseasHub.missingByReason)) {
    console.log(`    - ${k}: ${n}`)
  }

  console.log(`\n[해외 허브 미노출 registered]: ${summary.registeredInNeitherHub}건`)

  const printRows = (label: string, rows: Row[]) => {
    if (rows.length === 0) return
    console.log(`\n## ${label} (${rows.length}건)`)
    for (const r of rows.slice(0, 40)) {
      console.log(
        `  · ${r.originCode ?? r.slug ?? r.id} | ${r.supplier} | ${r.reasons.join(',')} | ${r.title}`,
      )
    }
    if (rows.length > 40) console.log(`  … 외 ${rows.length - 40}건`)
  }

  printRows('해외 허브 미노출', overseasMissing)

  if (inNeitherHub.length > 0) {
    console.log(`\n## 해외 허브 미노출 registered (${inNeitherHub.length}건)`)
    for (const r of inNeitherHub.slice(0, 30)) {
      console.log(
        `  · ${r.originCode ?? r.slug ?? r.id} | ${normalizeSupplierOrigin(r.originSource)} | scope=${r.travelScope ?? '-'} kind=${r.listingKind ?? '-'} | ${r.title.slice(0, 80)}`,
      )
    }
    if (inNeitherHub.length > 30) console.log(`  … 외 ${inNeitherHub.length - 30}건`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
