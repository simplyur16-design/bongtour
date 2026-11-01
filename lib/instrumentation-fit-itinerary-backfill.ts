/**
 * 자유여행 FitItinerary backfill — 매시간 cron만 (기동 직후 전량 실행 없음).
 * 배포 재시작 직후 DB·Gemini 부하로 해외/자유여행 browse가 막히는 것을 방지.
 *
 * production + DATABASE_URL + GEMINI_API_KEY (`instrumentation.ts` 가드).
 * 비활성화: `DISABLE_INSTRUMENTATION_FIT_ITINERARY_BACKFILL_CRON=1`
 * REGRESSION-FREEZE[fit-itinerary-pending-backfill]: pending도 Fit 마스터 백필 — manifest
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 사진 전 막힘(pre_photo_blocked)도 백필·향후 출발일 있는 상품만·실패 횟수 상한·패키지 자유일정 재시도 — manifest
 */
import { AIR_HOTEL_LISTING_KIND, AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'
import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'
import {
  FREE_DAY_ITINERARY_GENERATION_META_KEY,
  itineraryGenerationAttemptsExhausted,
} from '@/lib/fit-itinerary-generation-status'
import { futureDepartureWhere } from '@/lib/product-future-departure'

const CRON_EXPR = '0 * * * *'
const INTER_MS = 1500
const BACKFILL_TAKE = 20
/** 패키지 자유일정 추천일정 재시도 — 시간당 상한 */
const FREE_DAY_BACKFILL_TAKE = 10

export function startInstrumentationFitItineraryBackfillCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_FIT_ITINERARY_BACKFILL_CRON === '1') {
    return
  }

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
        travelScope: 'overseas',
        fitMaster: null,
        AND: [
          {
            OR: [
              { registrationStatus: 'registered' },
              { registrationStatus: 'pending' },
              { registrationStatus: 'pre_photo_blocked' },
              { registrationStatus: '' },
              { registrationStatus: null },
            ],
          },
          {
            OR: [
              { productType: AIR_HOTEL_PRODUCT_TYPE },
              { productType: 'airtel' },
              { listingKind: AIR_HOTEL_LISTING_KIND },
            ],
          },
        ],
        // 향후 출발일 없는 상품은 등록하지 않으므로 추천일정도 만들지 않는다
        departures: { some: futureDepartureWhere() },
      },
      select: { id: true, slug: true, rawMeta: true },
      orderBy: { createdAt: 'asc' },
      take: BACKFILL_TAKE * 3,
    }).then((rows) => rows.filter((r) => !itineraryGenerationAttemptsExhausted(r.rawMeta)).slice(0, BACKFILL_TAKE))

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
  await runPackageFreeDayItineraryBackfill()
}

/** 패키지 '#자유일정 포함' — 자유일정 날 추천일정이 빠진 등록 전 상품을 다시 만든다(실패는 rawMeta 에 남음) */
async function runPackageFreeDayItineraryBackfill(): Promise<void> {
  // 기본 꺼짐 — 승인 범위 밖 등록 전 상품을 매시 다시 만들지 않도록 켜는 스위치로만 돈다
  if (process.env.BONGTOUR_FREE_DAY_ITINERARY_BACKFILL !== '1') return
  try {
    const { prisma } = await import('@/lib/prisma')
    const { verifyRegisterPrePhotoForStoredProduct } = await import('@/lib/register-pre-photo-verify')
    const { rematerializeRegisterPrePhotoByLane } = await import('@/lib/register-pre-photo-lane-rematerialize')
    const rows = await prisma.product.findMany({
      where: {
        travelScope: 'overseas',
        registrationStatus: { in: ['pre_photo_blocked', 'pending'] },
        title: { contains: '자유일정' },
        NOT: [{ productType: AIR_HOTEL_PRODUCT_TYPE }, { listingKind: AIR_HOTEL_LISTING_KIND }],
        departures: { some: futureDepartureWhere() },
      },
      select: {
        id: true,
        slug: true,
        rawMeta: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        schedule: true,
        destination: true,
        title: true,
        countryKey: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    const targets = rows
      .filter((r) => !itineraryGenerationAttemptsExhausted(r.rawMeta, FREE_DAY_ITINERARY_GENERATION_META_KEY))
      .filter((r) => {
        const v = verifyRegisterPrePhotoForStoredProduct(r as never)
        return !v.ok && (v.issues ?? []).some((i) => i.includes('free_recommended_itinerary_missing'))
      })
      .slice(0, FREE_DAY_BACKFILL_TAKE)
    if (!targets.length) return
    let ok = 0
    for (const t of targets) {
      const r = await rematerializeRegisterPrePhotoByLane(t.id).catch(() => null)
      const still = !r || r.afterIssues.some((i) => i.includes('free_recommended_itinerary_missing'))
      if (!still) ok++
      console.log(`[free-day-itinerary-backfill] ${t.slug ?? t.id}: ${still ? 'FAIL' : 'OK'}`)
      await new Promise((res) => setTimeout(res, INTER_MS))
    }
    console.log(`[free-day-itinerary-backfill] done ok=${ok} of ${targets.length}`)
  } catch (e) {
    console.error('[free-day-itinerary-backfill] error', e)
  }
}
