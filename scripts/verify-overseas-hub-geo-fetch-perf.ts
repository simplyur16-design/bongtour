/**
 * 전량 vs 중·하 browse payload 지연 수치 + 오류 게이트.
 *   npm run verify:overseas-hub-geo-fetch-perf
 *
 * DATABASE_URL 없거나 CI placeholder(127.0.0.1:5432)면 skip(exit 0).
 * REGRESSION-FREEZE[overseas-hub-server-geo-fetch]: skip unreachable CI DB — manifest
 */
import './load-env-for-scripts'
import {
  buildOverseasHubBrowseQueryKey,
  buildOverseasHubCatalogFetchQueryKey,
} from '../lib/products-browse-hub-query'

type Case = { name: string; queryKey: string }

function hasReachableDatabaseUrl(): boolean {
  const raw = (process.env.DATABASE_URL ?? '').trim()
  if (!raw) return false
  if (/@(?:127\.0\.0\.1|localhost):5432\b/i.test(raw)) return false
  return true
}

async function timePayload(queryKey: string): Promise<{ ms: number; items: number; ok: boolean; err?: string }> {
  const t0 = performance.now()
  try {
    const { productsBrowseBuildPayload } = await import('../lib/products-browse-build-payload')
    const json = await productsBrowseBuildPayload(queryKey)
    const ms = Math.round(performance.now() - t0)
    if (!json || (json as { ok?: boolean }).ok === false) {
      return { ms, items: 0, ok: false, err: 'payload ok=false' }
    }
    const items = Array.isArray((json as { items?: unknown[] }).items)
      ? (json as { items: unknown[] }).items.length
      : 0
    return { ms, items, ok: true }
  } catch (e) {
    return {
      ms: Math.round(performance.now() - t0),
      items: 0,
      ok: false,
      err: e instanceof Error ? e.message : String(e),
    }
  }
}

async function main() {
  if (!hasReachableDatabaseUrl()) {
    console.log('[skip] verify-overseas-hub-geo-fetch-perf: DATABASE_URL unset or CI placeholder')
    process.exit(0)
  }

  const cases: Case[] = [
    { name: 'full-catalog', queryKey: buildOverseasHubCatalogFetchQueryKey() },
    {
      name: 'mid-kansai',
      queryKey: buildOverseasHubBrowseQueryKey(
        'scope=overseas&region=japan&country=japan&menuGroup=kansai',
      ),
    },
    {
      name: 'leaf-osaka',
      queryKey: buildOverseasHubBrowseQueryKey(
        'scope=overseas&region=japan&country=japan&menuGroup=kansai&city=osaka',
      ),
    },
    {
      name: 'mid-hokkaido',
      queryKey: buildOverseasHubBrowseQueryKey(
        'scope=overseas&region=japan&country=japan&menuGroup=hokkaido',
      ),
    },
    {
      name: 'country-thailand',
      queryKey: buildOverseasHubBrowseQueryKey(
        'scope=overseas&region=southeast-asia&country=thailand',
      ),
    },
  ]

  console.log('\n=== overseas hub geo fetch perf ===\n')

  for (const c of cases) {
    if (c.name !== 'full-catalog' && !c.queryKey.includes('limit=500')) {
      console.error(`[FAIL] ${c.name} expected geo-focused limit=500, got ${c.queryKey}`)
      process.exit(1)
    }
  }

  const results: Record<string, { ms: number; items: number; ok: boolean; err?: string }> = {}

  await timePayload(cases[0]!.queryKey)

  let failed = false
  for (const c of cases) {
    const a = await timePayload(c.queryKey)
    const b = await timePayload(c.queryKey)
    const best = a.ms <= b.ms ? a : b
    results[c.name] = best
    const flag = best.ok ? 'PASS' : 'FAIL'
    console.log(`[${flag}] ${c.name} ${best.ms}ms items=${best.items}${best.err ? ` err=${best.err}` : ''}`)
    console.log(`       key=${c.queryKey}`)
    if (!best.ok) failed = true
  }

  const full = results['full-catalog']
  const mid = results['mid-kansai']
  const leaf = results['leaf-osaka']
  const hokkaido = results['mid-hokkaido']

  if (full?.ok && mid?.ok) {
    const ratio = mid.ms / Math.max(1, full.ms)
    // mid must be faster than full (≤60%) and return fewer rows; hard cap 2s
    const ok = mid.ms <= full.ms * 0.6 && mid.items < full.items && mid.ms < 2000
    console.log(
      `\n[${ok ? 'PASS' : 'FAIL'}] mid vs full: mid=${mid.ms}ms items=${mid.items} / full=${full.ms}ms items=${full.items} ratio=${ratio.toFixed(2)}`,
    )
    if (!ok) failed = true
  }

  if (leaf?.ok && mid?.ok) {
    if (leaf.items > mid.items) {
      console.log(`[FAIL] leaf items (${leaf.items}) > mid items (${mid.items}) — leaf must narrow or equal`)
      failed = true
    } else {
      console.log(`[PASS] leaf items (${leaf.items}) <= mid items (${mid.items})`)
    }
  }

  if (hokkaido?.ok && mid?.ok) {
    // different mid columns must not return identical full-catalog sized pools
    if (hokkaido.items >= (full?.items ?? 0) && (full?.items ?? 0) > 10) {
      console.log(`[FAIL] hokkaido mid returned full-catalog-sized pool (${hokkaido.items})`)
      failed = true
    } else {
      console.log(`[PASS] hokkaido mid items=${hokkaido.items} (not full catalog)`)
    }
  }

  console.log(failed ? '\n=== FAILED ===\n' : '\n=== all passed ===\n')
  process.exit(failed ? 1 : 0)
}

void main()
