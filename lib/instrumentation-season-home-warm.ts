/**
 * 배포 직후 force-static 홈/해외허브가 build-time 빈 슬라이드로 남는 창을 줄인다.
 * unstable_cache를 런타임에 채운 뒤 `/`·`/m`·`/travel/overseas` loopback으로 ISR 재생성.
 *
 * 비활성: `DISABLE_SEASON_HOME_WARM_ON_STARTUP=1`
 */
import { getInternalLoopbackOrigin } from '@/lib/internal-loopback-origin'

const STARTUP_DELAY_MS = 20_000
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

async function loopbackHomePages(): Promise<void> {
  const origin = getInternalLoopbackOrigin()
  for (const route of ['/', '/m', '/travel/overseas'] as const) {
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
    const counts = await warmSeasonDataCaches()
    console.log('[season-home-warm] data caches', counts)
    await loopbackHomePages()
  } catch (e) {
    console.error('[season-home-warm] startup error', e)
  }
}

/** REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: post-deploy home+overseas warm — manifest */
export function startInstrumentationSeasonHomeWarm(): void {
  void runSeasonHomeWarmOnStartup()
}
