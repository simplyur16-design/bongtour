/**
 * 배포 직후 force-static 홈/해외허브가 build-time 빈 슬라이드로 남는 창을 줄인다.
 * Data Cache warm → cron revalidatePath(빈 HTML Full Route Cache 폐기) → loopback ISR 재생성.
 *
 * 비활성: `DISABLE_SEASON_HOME_WARM_ON_STARTUP=1`
 * REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: warm must revalidatePath before loopback — manifest
 */
import { getBongtourCronSecret } from '@/lib/cron-auth'
import { getInternalLoopbackOrigin } from '@/lib/internal-loopback-origin'

/** 서버 listen 직후 짧게 대기 — 20s면 CDN이 빈 셸을 먼저 캐시한다 */
const STARTUP_DELAY_MS = 3_000
const HTTP_TIMEOUT_MS = 45_000

async function warmSeasonDataCaches(): Promise<{
  hero: number
  next3: number
  persona: number
  overseasHero: number
}> {
  const { getCachedSeasonCurationHeroSlides, getCachedSeasonCurationNextThreeMonthsSlides, getCachedCurrentCycle } =
    await import('@/lib/season-curation-content')
  const { getPersonaCuratedDestinationsPayload } = await import('@/lib/persona-curated-destinations')
  const { getCachedOverseasHubSeasonDestinationHeroSlides } = await import(
    '@/lib/overseas-hub-season-destination-hero'
  )

  const [hero, next3, cycle] = await Promise.all([
    getCachedSeasonCurationHeroSlides(),
    getCachedSeasonCurationNextThreeMonthsSlides(),
    getCachedCurrentCycle(),
  ])
  const [persona, overseasHero] = await Promise.all([
    getPersonaCuratedDestinationsPayload(cycle),
    getCachedOverseasHubSeasonDestinationHeroSlides(cycle),
  ])
  return {
    hero: hero.length,
    next3: next3.length,
    persona: persona.cards.length,
    overseasHero: overseasHero.length,
  }
}

/**
 * revalidatePath must run inside a Route Handler request context — not raw instrumentation.
 * Hit the existing season-cache-revalidate cron over loopback.
 */
async function revalidateSeasonHomePaths(): Promise<boolean> {
  const secret = getBongtourCronSecret()
  if (!secret) {
    console.warn('[season-home-warm] skip path revalidate: BONGTOUR_CRON_SECRET unset')
    return false
  }
  const origin = getInternalLoopbackOrigin()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    const res = await fetch(`${origin}/api/cron/season-cache-revalidate`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'user-agent': 'BongTourSeasonHomeWarm/1.0',
        'content-type': 'application/json',
        'x-bongtour-cron-secret': secret,
      },
      body: '{}',
    })
    console.log('[season-home-warm] revalidatePath via cron', { status: res.status })
    return res.ok
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[season-home-warm] path revalidate failed', { message })
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function loopbackHomePages(): Promise<void> {
  const origin = getInternalLoopbackOrigin()
  for (const route of ['/', '/m', '/travel/overseas', '/business'] as const) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
    try {
      const res = await fetch(`${origin}${route}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'user-agent': 'BongTourSeasonHomeWarm/1.0',
          accept: 'text/html',
        },
        redirect: 'follow',
      })
      console.log('[season-home-warm] loopback', { route, status: res.status })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.warn('[season-home-warm] loopback failed', { route, message })
    } finally {
      clearTimeout(timer)
    }
  }
}

async function runSeasonHomeWarmOnStartup(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.DISABLE_SEASON_HOME_WARM_ON_STARTUP === '1') {
    console.log('[season-home-warm] skipped (DISABLE_SEASON_HOME_WARM_ON_STARTUP=1)')
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[season-home-warm] skip: DATABASE_URL')
    return
  }

  await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS))
  try {
    let counts = await warmSeasonDataCaches()
    console.log('[season-home-warm] data caches', counts)
    if (counts.persona === 0 || counts.overseasHero === 0) {
      // One retry — deploy race where cycle/products were not ready on first pass.
      await new Promise((r) => setTimeout(r, 5_000))
      counts = await warmSeasonDataCaches()
      console.log('[season-home-warm] data caches retry', counts)
    }
    // REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: revalidatePath before loopback — manifest
    await revalidateSeasonHomePaths()
    await loopbackHomePages()
    if (counts.overseasHero === 0) {
      console.error(
        '[season-home-warm] overseas hero still empty after warm — check SeasonalDestinationCuration cycle',
      )
    }
  } catch (e) {
    console.error('[season-home-warm] startup error', e)
  }
}

/** REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: post-deploy home+overseas warm — manifest */
export function startInstrumentationSeasonHomeWarm(): void {
  void runSeasonHomeWarmOnStartup()
}
