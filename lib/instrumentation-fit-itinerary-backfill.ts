/**
 * 자유여행 FitItinerary backfill — 서버 기동 1회 + 매시간 cron.
 * production + DATABASE_URL + GEMINI_API_KEY (`instrumentation.ts` 가드).
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_FIT_ITINERARY_BACKFILL_CRON=1`
 */
import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'

const CRON_EXPR = '0 * * * *'
const INTER_MS = 1500

export function startInstrumentationFitItineraryBackfillCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_FIT_ITINERARY_BACKFILL_CRON === '1') {
    return
  }

  void runFitItineraryBackfillOnBoot()

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        CRON_EXPR,
        () => {
          void runFitItineraryBackfillOnBoot()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[fit-itinerary-backfill] registered: ${CRON_EXPR} (Asia/Seoul, 매시간)`)
    })
    .catch((e) => {
      console.error('[fit-itinerary-backfill] failed to load node-cron', e)
    })
}

async function runFitItineraryBackfillOnBoot(): Promise<void> {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[fit-itinerary-backfill] skip: DATABASE_URL')
      return
    }
    if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
      console.warn('[fit-itinerary-backfill] skip: GEMINI_API_KEY')
      return
    }

    const { prisma } = await import('@/lib/prisma')
    const targets = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        travelScope: 'overseas',
        productType: 'airtel',
        fitMaster: null,
      },
      select: { id: true, slug: true },
      orderBy: { createdAt: 'asc' },
    })

    if (targets.length === 0) {
      console.log('[fit-itinerary-backfill] no targets')
      return
    }

    console.log(`[fit-itinerary-backfill] processing ${targets.length} products…`)

    let ok = 0
    let fail = 0
    let skip = 0

    for (const target of targets) {
      const result = await generateFitItineraryForProduct(target.id)
      const label = target.slug ?? target.id
      if (result.success) {
        ok++
        console.log(`[fit-itinerary-backfill] ${label}: OK master=${result.masterId}`)
      } else if (result.reason === 'already_exists') {
        skip++
        console.log(`[fit-itinerary-backfill] ${label}: skip (already_exists)`)
      } else {
        fail++
        console.log(
          `[fit-itinerary-backfill] ${label}: FAIL reason=${result.reason ?? 'unknown'}`,
          result.error instanceof Error ? result.error.message : result.error,
        )
      }
      await new Promise((r) => setTimeout(r, INTER_MS))
    }

    console.log(`[fit-itinerary-backfill] done ok=${ok} fail=${fail} skip=${skip}`)
  } catch (e) {
    console.error('[fit-itinerary-backfill] error', e)
  }
}
