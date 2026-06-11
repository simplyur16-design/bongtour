/**
 * 메가메뉴 권역 URL 연속 요청 — RSC 200·응답 크기·하위분류 데이터 검증.
 * 사용: npx tsx scripts/verify-overseas-mega-nav-loop.ts [baseUrl]
 */
import { buildOverseasHubCatalogSectionsForUrl } from '../lib/overseas-hub-catalog-sections'
import { filterOverseasHubCatalogByUrl } from '../lib/overseas-hub-client-catalog-filter'
import { MEGA_MENU_REGION_CITY_GROUP_TAB_IDS } from '../lib/overseas-mega-region-city-group'
import { buildOverseasHubCatalogFetchQueryKey } from '../lib/products-browse-hub-query'
import type { ResultItem } from '../components/products/ProductResultsList'

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

async function main() {
  console.log(`\n=== mega nav loop verify (${base}) ===\n`)

  try {
    const ping = await fetch(base, { signal: AbortSignal.timeout(30_000) })
    if (!ping.ok) {
      console.error(`[ABORT] dev server HTTP ${ping.status}`)
      process.exit(1)
    }
  } catch (e) {
    console.error(`[ABORT] dev server unreachable: ${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }

  const catalogKey = buildOverseasHubCatalogFetchQueryKey()
  const apiRes = await fetch(`${base}/api/products/browse?${catalogKey}`, {
    signal: AbortSignal.timeout(60_000),
  })
  const apiJson = (await apiRes.json()) as { ok?: boolean; items?: ResultItem[] }
  const items = apiJson.items ?? []
  console.log(`[PASS] browse-api items=${items.length}`)

  const paths = [
    '/travel/overseas',
    ...MEGA_MENU_REGION_CITY_GROUP_TAB_IDS.map((r) => `/travel/overseas?scope=overseas&region=${r}`),
  ]

  let maxBytes = 0
  let maxMs = 0
  for (const path of paths) {
    const t0 = Date.now()
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(90_000) })
    const html = await res.text()
    const ms = Date.now() - t0
    maxBytes = Math.max(maxBytes, html.length)
    maxMs = Math.max(maxMs, ms)
    const ok = res.ok && ms < 60_000
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${path} HTTP ${res.status} ${ms}ms bytes=${html.length}`)
    if (!ok) process.exit(1)
  }

  console.log(`[PASS] max-bytes=${maxBytes} max-ms=${maxMs}`)

  for (const regionId of MEGA_MENU_REGION_CITY_GROUP_TAB_IDS) {
    const sp = new URLSearchParams(`scope=overseas&region=${regionId}`)
    const filtered = filterOverseasHubCatalogByUrl(items, sp)
    const sections = buildOverseasHubCatalogSectionsForUrl(filtered, sp)
    const labels = sections.map((s) => s.label).filter(Boolean)
    const ok = sections.length >= 1
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] subgroup-data ${regionId} sections=${sections.length} labels=${labels.slice(0, 4).join(', ')}`,
    )
    if (!ok) process.exit(1)
  }

  console.log('\n=== all passed ===\n')
  process.exit(0)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
