/**
 * 매 5시간(0/5/10/15/20시 KST) + 배포 직후 1회 — 공개 정적 페이지 GET으로 ISR/unstable_cache 워밍.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_CACHE_WARM_CRON=1`
 * Dry-run: `CACHE_WARM_CRON_DRY_RUN=1` (fetch 생략, routes만 로그)
 */
import { CACHE_WARM_ROUTES } from '@/lib/cache-warm-routes'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
} from '@/lib/products-browse-hub-query'
import { getSiteOrigin } from '@/lib/site-metadata'

/** 허브 목록 API — RSC 임베드 제거 후 cron으로 `unstable_cache` 워밍 */
const CACHE_WARM_BROWSE_API_PATHS = [
  `/api/products/browse?${buildOverseasHubBrowseQueryKey('scope=overseas')}`,
  `/api/products/browse?${buildAirHotelHubBrowseQueryKey('scope=overseas&type=air-hotel')}`,
] as const

const FETCH_TIMEOUT_MS = 8_000
const CRON_EXPR = '0 */5 * * *'

function isCacheWarmDryRun(): boolean {
  return process.env.CACHE_WARM_CRON_DRY_RUN === '1'
}

async function fetchWithTimeout(
  url: string,
  accept = 'text/html',
): Promise<{ status: number; durationMs: number }> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
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

async function runCacheWarmTick(source: 'cron' | 'startup'): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[cache-warm-cron] skip: DATABASE_URL')
    return
  }

  const dryRun = isCacheWarmDryRun()
  const origin = getSiteOrigin()
  const tickStarted = Date.now()
  let success = 0
  let failed = 0

  const routes = [...CACHE_WARM_ROUTES, ...CACHE_WARM_BROWSE_API_PATHS]

  console.log('[cache-warm-cron] tick start', {
    source,
    dryRun,
    origin,
    routeCount: routes.length,
    browseApiCount: CACHE_WARM_BROWSE_API_PATHS.length,
  })

  if (dryRun) {
    console.log('[cache-warm-cron] dry-run routes', routes)
    return
  }

  for (const route of routes) {
    const url = `${origin}${route}`
    const accept = route.startsWith('/api/products/browse') ? 'application/json' : 'text/html'
    try {
      const { status, durationMs } = await fetchWithTimeout(url, accept)
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

  console.log('[cache-warm-cron] tick done', {
    source,
    success,
    failed,
    total: routes.length,
    durationMs: Date.now() - tickStarted,
  })
}

async function seedCacheWarmOnStartup(): Promise<void> {
  try {
    /** instrumentation은 HTTP 리슨 전에 돌 수 있어, 서버 기동 후 워밍 */
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
        { timezone: 'Asia/Seoul' }
      )
      console.log(`[cache-warm-cron] registered: ${CRON_EXPR} (Asia/Seoul)`)
    })
    .catch((e) => {
      console.error('[cache-warm-cron] failed to load node-cron', e)
    })
}
