import { parseBrowseQuery } from '@/lib/products-browse-query'
import { BrowseRouteClientError, browsePerfLastPhases } from '@/lib/products-browse-build-payload'
import { getCachedProductsBrowsePayload } from '@/lib/products-browse-cached'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

function browseErrorBodyFromQueryKey(queryKey: string) {
  let q: ReturnType<typeof parseBrowseQuery>
  try {
    q = parseBrowseQuery(new URLSearchParams(queryKey))
  } catch {
    throw new BrowseRouteClientError(
      'api.products.browse.bad-query',
      { ok: false, error: '요청 파라미터를 처리하지 못했습니다.' },
      400,
    )
  }
  const sp = new URLSearchParams(queryKey)
  return {
    ok: false as const,
    error: '상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    page: q.page,
    limit: q.limit,
    destinationTerms: [] as string[],
    suggestedBudgetMax: null as number | null,
    facets: {
      brands: [] as { key: string; label: string; count: number }[],
      airlines: [] as { code: string; label: string; count: number }[],
      hasDepartureTimeData: false,
      hasWeekdayData: false,
    },
    queryEcho: {
      type: sp.get('type'),
      categories: q.categories,
      region: sp.get('region'),
      country: sp.get('country'),
      city: sp.get('city'),
    },
  }
}

/**
 * GET /api/products/browse
 *
 * `unstable_cache`(1h)로 DB·필터 결과 재사용. `force-dynamic` 없음 — 캐시 히트 시 응답 가속.
 */
export async function GET(request: Request) {
  const queryKey = new URL(request.url).searchParams.toString()
  const perfGet = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const tGet0 = perfGet ? performance.now() : 0 // PERF-LOG: 측정 후 제거
  const cacheKey = `products-browse-v19|${queryKey}` // PERF-LOG: 측정 후 제거
  try {
    const perfPhasesBefore = browsePerfLastPhases // PERF-LOG: 측정 후 제거
    const payload = await getCachedProductsBrowsePayload(queryKey)
    const cacheHit = browsePerfLastPhases === perfPhasesBefore // PERF-LOG: 측정 후 제거
    const res = jsonWithLeakGuard(payload, 'api.products.browse.ok') // PERF-LOG: 측정 후 제거
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    if (perfGet) {
      const totalMs = Math.round(performance.now() - tGet0) // PERF-LOG: 측정 후 제거
      if (cacheHit) {
        res.headers.set('Server-Timing', `total;dur=${totalMs}, cacheHit;desc="1"`) // PERF-LOG: 측정 후 제거
        console.log(
          '[browse-perf]',
          JSON.stringify({
            cacheKey,
            cacheHit: true,
            totalMs,
            parseMs: null,
            dbMs: null,
            filterMs: null,
            scoreMs: null,
            mapMs: null,
            rowCount: null,
            finalCount: null,
          }),
        ) // PERF-LOG: 측정 후 제거
      } else if (browsePerfLastPhases) {
        const p = browsePerfLastPhases // PERF-LOG: 측정 후 제거
        res.headers.set(
          'Server-Timing',
          `parse;dur=${p.parseMs}, db;dur=${p.dbMs}, filter;dur=${p.filterMs}, score;dur=${p.scoreMs}, map;dur=${p.mapMs}, total;dur=${totalMs}`,
        ) // PERF-LOG: 측정 후 제거
      }
    }
    return res
  } catch (e) {
    if (e instanceof BrowseRouteClientError) {
      return jsonWithLeakGuard(e.body, e.guardContext, { status: e.status })
    }
    console.error('[GET /api/products/browse]', e)
    try {
      const body = browseErrorBodyFromQueryKey(queryKey)
      return jsonWithLeakGuard(body, 'api.products.browse.error', { status: 500 })
    } catch (inner) {
      if (inner instanceof BrowseRouteClientError) {
        return jsonWithLeakGuard(inner.body, inner.guardContext, { status: inner.status })
      }
      throw inner
    }
  }
}
