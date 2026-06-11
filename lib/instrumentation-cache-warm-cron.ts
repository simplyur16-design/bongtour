/**
 * 매 5시간(0/5/10/15/20시 KST) + 배포 직후 1회 — 공개 정적 페이지 GET으로 ISR/unstable_cache 워밍.
 *
 * 해외·항공+호텔 허브·browse API는 HTTP loopback 금지(단일 프로세스 502).
 * browse 캐시는 cron + `CACHE_WARM_HEAVY_BROWSE=1` 일 때만 in-process 직접 워밍.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_CACHE_WARM_CRON=1`
 * Dry-run: `CACHE_WARM_CRON_DRY_RUN=1` (fetch 생략, routes만 로그)
 */
import { CACHE_WARM_HTTP_ROUTES } from '@/lib/cache-warm-routes'
import { getCachedProductsBrowsePayload } from '@/lib/products-browse-cached'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
} from '@/lib/products-browse-hub-query'
import { hubBrowsePrefetchWithTimeout } from '@/lib/products-browse-hub-prefetch-timeout'
import { getSiteOrigin } from '@/lib/site-metadata'

const CACHE_WARM_BROWSE_QUERY_KEYS = [
  buildOverseasHubBrowseQueryKey('scope=overseas'),
  buildAirHotelHubBrowseQueryKey('scope=overseas&type=air-hotel'),
] as const

/** 가벼운 정적·허브 페이지 — HTTP loopback 허용 상한 */
const LIGHT_HTTP_TIMEOUT_MS = 30_000

/** cron 전용 browse in-process 워밍 상한 (초과 시 로그만, SSR 블로킹 방지) */
const HEAVY_BROWSE_WARM_TIMEOUT_MS = 60_000

const CRON_EXPR = '0 */5 * * *'

let tickInFlight = false

function isCacheWarmDryRun(): boolean {
  return process.env.CACHE_WARM_CRON_DRY_RUN === '1'
}

function heavyBrowseWarmEnabled(): boolean {
  return process.env.CACHE_WARM_HEAVY_BROWSE === '1'
}

async function fetchWithTimeout(
  url: string,
  accept = 'text/html',
  timeoutMs = LIGHT_HTTP_TIMEOUT_MS,
): Promise<{ status: number; durationMs: number }> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'user-agent': 'BongTourCacheWarm/1.0',
        accept,
      },
      redirect: 'follow',
    })
    return { status: res.status, durationMs: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

async function warmHubBrowseCachesDirect(): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const queryKey of CACHE_WARM_BROWSE_QUERY_KEYS) {
    const started = Date.now()
    try {
      const payload = await hubBrowsePrefetchWithTimeout(
        getCachedProductsBrowsePayload(queryKey),
        HEAVY_BROWSE_WARM_TIMEOUT_MS,
      )
      const ok = payload != null
      if (ok) success += 1
      else failed += 1
      console.log('[cache-warm-cron] browse-direct', {
        queryKey,
        durationMs: Date.now() - started,
        ok,
      })
    } catch (e) {
      failed += 1
      const message = e instanceof Error ? e.message : String(e)
      console.warn('[cache-warm-cron] browse-direct failed', { queryKey, message })
    }
  }

  return { success, failed }
}

async function runCacheWarmTick(source: 'cron' | 'startup'): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[cache-warm-cron] skip: DATABASE_URL')
    return
  }
  if (tickInFlight) {
    console.warn('[cache-warm-cron] skip: previous tick still running', { source })
    return
  }

  tickInFlight = true
  try {
    const dryRun = isCacheWarmDryRun()
    const origin = getSiteOrigin()
    const tickStarted = Date.now()
    let success = 0
    let failed = 0

    const routes = [...CACHE_WARM_HTTP_ROUTES]

    console.log('[cache-warm-cron] tick start', {
      source,
      dryRun,
      origin,
      httpRouteCount: routes.length,
      heavyBrowseWarm: source === 'cron' && heavyBrowseWarmEnabled(),
    })

    if (dryRun) {
      console.log('[cache-warm-cron] dry-run http routes', routes)
      if (source === 'cron' && heavyBrowseWarmEnabled()) {
        console.log('[cache-warm-cron] dry-run browse keys', [...CACHE_WARM_BROWSE_QUERY_KEYS])
      }
      return
    }

    for (const route of routes) {
      const url = `${origin}${route}`
      try {
        const { status, durationMs } = await fetchWithTimeout(url)
        const ok = status >= 200 && status < 400
        if (ok) success += 1
        else failed += 1
        console.log('[cache-warm-cron] route', { route, status, durationMs, ok })
      } catch (e) {
        failed += 1
        const message = e instanceof Error ? e.message : String(e)
        console.warn('[cache-warm-cron] route failed', { route, message })
      }
    }

    if (source === 'cron' && heavyBrowseWarmEnabled()) {
      const browse = await warmHubBrowseCachesDirect()
      success += browse.success
      failed += browse.failed
    }

    console.log('[cache-warm-cron] tick done', {
      source,
      success,
      failed,
      httpRoutes: routes.length,
      durationMs: Date.now() - tickStarted,
    })
  } finally {
    tickInFlight = false
  }
}

async function seedCacheWarmOnStartup(): Promise<void> {
  try {
    /** instrumentation은 HTTP 리슨 전에 돌 수 있어, 서버 기동 후 가벼운 페이지만 워밍 */
    await new Promise((r) => setTimeout(r, 20_000))
    await runCacheWarmTick('startup')
  } catch (e) {
    console.error('[cache-warm-cron] startup seed error', e)
  }
}

export function startInstrumentationCacheWarmCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_CACHE_WARM_CRON === '1') {
    return
  }

  void seedCacheWarmOnStartup()

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        CRON_EXPR,
        () => {
          void runCacheWarmTick('cron')
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[cache-warm-cron] registered: ${CRON_EXPR} (Asia/Seoul)`)
    })
    .catch((e) => {
      console.error('[cache-warm-cron] failed to load node-cron', e)
    })
}
