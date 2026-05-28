import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { CALENDAR_PRICES_MIN_ADULT_PRICE_KRW } from '@/lib/calendar-prices-adult-floor'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import {
  computeProductBatchWindow,
  maxDepartureYmdFromGroup,
} from '@/lib/calendar-batch-product-window'
import { addCalendarDaysYmd, seoulCalendarYmd, HORIZON_DAYS } from '@/lib/scraper-schedule-strategy'

type SchedulerScraperSite = CanonicalOverseasSupplierKey

function toSite(originSource: string | null): SchedulerScraperSite | null {
  const key = normalizeSupplierOrigin(originSource)
  return key === 'etc' ? null : key
}

function isWindsorOrigin(originSource: string | null): boolean {
  return (originSource ?? '').trim().toLowerCase() === 'windsor'
}

function hasFutureDeparturesFromMax(maxYmd: string | null, todayYmd: string): boolean {
  if (!maxYmd) return false
  return maxYmd >= todayYmd
}

/**
 * GET /api/admin/scheduler/products. 인증: 관리자.
 * 등록완료 + 미래 출발(성인가 하한 이상) + windsor(공공기업) 제외.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const now = new Date()
    const todaySeoulYmd = seoulCalendarYmd()
    const horizonYmd = addCalendarDaysYmd(todaySeoulYmd, HORIZON_DAYS)

    const [queued, allProducts] = await Promise.all([
      prisma.scraperQueue.findMany({
        orderBy: { createdAt: 'asc' },
        select: { productId: true },
      }),
      prisma.product.findMany({
        where: {
          registrationStatus: 'registered',
          originCode: { not: '' },
          NOT: { originSource: { equals: 'windsor', mode: 'insensitive' } },
          departures: {
            some: {
              departureDate: { gte: now },
              adultPrice: { gte: CALENDAR_PRICES_MIN_ADULT_PRICE_KRW },
            },
          },
        },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, originCode: true, originSource: true, rawMeta: true },
      }),
    ])

    const productIds = allProducts.map((p) => p.id)
    const maxDepRows =
      productIds.length > 0
        ? await prisma.productDeparture.groupBy({
            by: ['productId'],
            where: { productId: { in: productIds } },
            _max: { departureDate: true },
          })
        : []
    const maxDepByProduct = new Map<string, Date>()
    for (const row of maxDepRows) {
      if (row._max.departureDate) maxDepByProduct.set(row.productId, row._max.departureDate)
    }

    const queuedIds = new Set(queued.map((q) => q.productId))
    const inQueue = allProducts.filter((p) => queuedIds.has(p.id))
    const rest = allProducts.filter((p) => !queuedIds.has(p.id))
    const products = [...inQueue, ...rest]
    const list = products
      .filter((p) => !isWindsorOrigin(p.originSource))
      .map((p) => {
        const site = toSite(p.originSource)
        if (!site) return null
        const maxDepartureYmd = maxDepartureYmdFromGroup(maxDepByProduct, p.id)
        const hasFutureDepartures = hasFutureDeparturesFromMax(maxDepartureYmd, todaySeoulYmd)

        if (site === 'modetour') {
          return {
            id: p.id,
            originCode: p.originCode,
            originSource: p.originSource,
            site,
            detailUrl: buildDetailUrl(p.originSource ?? '', p.originCode),
            sequentialEligible: false,
            rangeStartYmd: todaySeoulYmd,
            rangeEndYmd: horizonYmd,
            hasFutureDepartures,
            horizonYmd,
            todaySeoulYmd,
          }
        }

        const win = computeProductBatchWindow({
          rawMeta: p.rawMeta,
          maxDepartureYmd,
          todaySeoulYmd,
          horizonYmd,
          hasFutureDepartures,
        })
        return {
          id: p.id,
          originCode: p.originCode,
          originSource: p.originSource,
          site,
          detailUrl: buildDetailUrl(p.originSource ?? '', p.originCode),
          sequentialEligible: true,
          hasFutureDepartures,
          calendarBatchCursorYmd: win.cursorYmd,
          rangeStartYmd: win.rangeStartYmd,
          rangeEndYmd: win.rangeEndYmd,
          atHorizon: win.atHorizon,
          windowEmpty: win.windowEmpty,
          retired: win.retired,
          horizonYmd,
          todaySeoulYmd,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
    return NextResponse.json(list)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}
