/**
 * 해외 허브 `/travel/overseas` 라이브 검증 — API·RSC HTML·메가메뉴 하위 분류.
 * 사용: npx tsx scripts/verify-overseas-hub-live.ts [baseUrl]
 */
import './load-env-for-scripts'
import type { ResultItem } from '../components/products/ProductResultsList'
import { OVERSEAS_DISPLAY_BUCKET_LABEL } from '../lib/overseas-display-buckets'
import { filterOverseasHubCatalogByUrl } from '../lib/overseas-hub-client-catalog-filter'
import { buildOverseasHubCatalogSectionsForUrl } from '../lib/overseas-hub-catalog-sections'
import {
  MEGA_MENU_REGION_CITY_GROUP_TAB_IDS,
  megaMenuSubgroupLabelsInOrder,
} from '../lib/overseas-mega-region-city-group'
import { buildOverseasHubCatalogFetchQueryKey } from '../lib/products-browse-hub-query'

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

type Check = { name: string; ok: boolean; detail: string }

const checks: Check[] = []

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}: ${detail}`)
}

function h2Present(html: string, label: string): boolean {
  return html.includes(`>${label}</h2>`)
}

async function fetchPageHtml(path: string): Promise<{ ok: boolean; html: string; status: number }> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000) })
  const html = await res.text()
  return { ok: res.ok, html, status: res.status }
}

function formatFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg === 'fetch failed' || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return `${msg} — dev 서버가 ${base} 에서 응답하지 않습니다. 다른 터미널에서 npm run dev:clean 이 Ready 된 뒤 다시 실행하세요.`
  }
  return msg
}

async function assertDevServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(45_000) })
    return res.ok || res.status < 500
  } catch (e) {
    console.error(`\n[ABORT] ${formatFetchError(e)}\n`)
    return false
  }
}

async function main() {
  const catalogKey = buildOverseasHubCatalogFetchQueryKey()
  console.log(`\n=== overseas hub live verify (${base}) ===\n`)
  console.log(`catalogQueryKey: ${catalogKey}`)

  if (!(await assertDevServerReachable())) {
    process.exit(1)
  }

  const apiUrl = `${base}/api/products/browse?${catalogKey}`
  let catalogItems: ResultItem[] = []
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30_000) })
    const apiJson = (await res.json()) as { ok?: boolean; total?: number; items?: ResultItem[] }
    record('browse-api-status', res.ok, `HTTP ${res.status}`)
    const itemCount = apiJson?.items?.length ?? 0
    record(
      'browse-api-payload',
      apiJson?.ok === true && itemCount > 0,
      `ok=${String(apiJson?.ok)} items=${itemCount} total=${apiJson?.total ?? '?'}`,
    )
    if (apiJson?.ok && Array.isArray(apiJson.items)) {
      catalogItems = apiJson.items
    }
  } catch (e) {
    record('browse-api', false, formatFetchError(e))
  }

  if (catalogItems.length > 0) {
    for (const regionId of MEGA_MENU_REGION_CITY_GROUP_TAB_IDS) {
      const sp = new URLSearchParams(`scope=overseas&region=${regionId}`)
      const filtered = filterOverseasHubCatalogByUrl(catalogItems, sp)
      const sections = buildOverseasHubCatalogSectionsForUrl(filtered, sp)
      const labels = sections.map((s) => s.label).filter(Boolean)
      const expectedOrder = megaMenuSubgroupLabelsInOrder(regionId)
      const hasSubgroupShape =
        sections.length >= 1 &&
        labels.length >= 1 &&
        (sections.length >= 2 || filtered.length < 3)
      record(
        `mega-catalog-${regionId}`,
        hasSubgroupShape,
        `sections=${sections.length} sample=${labels.slice(0, 4).join(', ') || '(none)'} order0=${expectedOrder[0] ?? '?'}`,
      )
    }
  }

  const regionPaths = [
    '/travel/overseas',
    '/travel/overseas?scope=overseas&region=japan',
    '/travel/overseas?scope=overseas&region=southeast-asia',
    '/travel/overseas?scope=overseas&region=europe-me',
    '/travel/overseas?scope=overseas&region=china-hk-mo',
    '/travel/overseas?scope=overseas&region=oceania',
    '/travel/overseas?scope=overseas&region=americas',
    '/travel/overseas?scope=overseas&region=south-america',
    '/travel/overseas?scope=overseas&region=southeast-asia&country=thailand',
  ]

  for (const path of regionPaths) {
    const slug = path.replace('/travel/overseas', 'hub').replace(/[?&=]/g, '-').replace(/^-/, '') || 'hub-default'
    try {
      const t0 = Date.now()
      const { ok, html, status } = await fetchPageHtml(path)
      const ms = Date.now() - t0
      record(`${slug}-status`, ok && status === 200, `HTTP ${status} ${ms}ms`)
      record(`${slug}-html-light`, html.length < 900_000, `bytes=${html.length}`)
    } catch (e) {
      record(slug, false, formatFetchError(e))
    }
  }

  if (catalogItems.length > 0) {
    const defaultSections = buildOverseasHubCatalogSectionsForUrl(
      catalogItems,
      new URLSearchParams('scope=overseas'),
    )
    record(
      'layout-default-buckets',
      defaultSections.some((s) => s.label === OVERSEAS_DISPLAY_BUCKET_LABEL.japan),
      defaultSections.map((s) => s.label).slice(0, 3).join(', '),
    )
    const thSections = buildOverseasHubCatalogSectionsForUrl(
      filterOverseasHubCatalogByUrl(
        catalogItems,
        new URLSearchParams('scope=overseas&region=southeast-asia&country=thailand'),
      ),
      new URLSearchParams('scope=overseas&region=southeast-asia&country=thailand'),
    )
    record(
      'layout-country-thailand',
      thSections.length === 1 && thSections[0]?.label === '태국',
      thSections[0]?.label ?? '(none)',
    )
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== ${checks.length - failed.length}/${checks.length} passed ===\n`)
  if (failed.length > 0) {
    console.error('FAILED:')
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  process.exit(0)
}

void main()
