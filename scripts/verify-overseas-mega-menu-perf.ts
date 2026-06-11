/**
 * 메가메뉴 권역 — 실 API 266건 기준 필터·하위분류 성능 직접 측정.
 * 사용: npx tsx scripts/verify-overseas-mega-menu-perf.ts [baseUrl]
 */
import { buildOverseasHubCatalogFetchQueryKey } from '../lib/products-browse-hub-query'
import { buildOverseasHubMegaSubgroupSections } from '../lib/overseas-hub-catalog-sections'
import {
  getOverseasHubCatalogForMegaRegionTab,
  rebuildOverseasHubMegaRegionIndex,
} from '../lib/overseas-hub-catalog-region-index'
import { MEGA_MENU_REGION_CITY_GROUP_TAB_IDS } from '../lib/overseas-mega-region-city-group'

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

async function main() {
  console.log(`\n=== mega menu perf verify (${base}) ===\n`)

  const tApi = Date.now()
  const res = await fetch(`${base}/api/products/browse?${buildOverseasHubCatalogFetchQueryKey()}`, {
    signal: AbortSignal.timeout(120_000),
  })
  const json = (await res.json()) as { ok?: boolean; items?: unknown[] }
  const items = (json.items ?? []) as import('../components/products/ProductResultsList').ResultItem[]
  console.log(`[${res.ok ? 'PASS' : 'FAIL'}] API ${Date.now() - tApi}ms items=${items.length}`)

  const withTab = items.filter((x) => (x.browseMegaRegionTabId ?? '').trim()).length
  const withBucket = items.filter((x) => x.overseasBucket).length
  console.log(
    `[${withTab === items.length ? 'PASS' : 'FAIL'}] browseMegaRegionTabId ${withTab}/${items.length}`,
  )
  console.log(`[INFO] overseasBucket ${withBucket}/${items.length}`)

  const tIdx = Date.now()
  rebuildOverseasHubMegaRegionIndex(items)
  const idxMs = Date.now() - tIdx
  console.log(`[${idxMs < 500 ? 'PASS' : 'FAIL'}] index-build ${idxMs}ms`)

  let maxMs = 0
  for (const regionId of MEGA_MENU_REGION_CITY_GROUP_TAB_IDS) {
    const t0 = Date.now()
    const filtered = getOverseasHubCatalogForMegaRegionTab(regionId) ?? []
    const sections = buildOverseasHubMegaSubgroupSections(filtered, regionId)
    const ms = Date.now() - t0
    maxMs = Math.max(maxMs, ms)
    const ok = ms < 500
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] ${regionId} items=${filtered.length} sections=${sections.length} ${ms}ms labels=${sections
        .slice(0, 3)
        .map((s) => s.label)
        .join(',')}`,
    )
    if (!ok) process.exit(1)
  }

  console.log(`[${maxMs < 500 ? 'PASS' : 'FAIL'}] max-region-ms=${maxMs}`)

  for (const path of [
    '/travel/overseas',
    '/travel/overseas?scope=overseas&region=japan',
    '/travel/overseas?scope=overseas&region=southeast-asia',
  ]) {
    const t0 = Date.now()
    const pageRes = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000) })
    const html = await pageRes.text()
    const ms = Date.now() - t0
    const ok = pageRes.ok && html.length < 500_000 && ms < 60_000
    console.log(`[${ok ? 'PASS' : 'FAIL'}] GET ${path} HTTP ${pageRes.status} ${ms}ms bytes=${html.length}`)
    if (!ok) process.exit(1)
  }

  console.log('\n=== all passed ===\n')
  process.exit(0)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
