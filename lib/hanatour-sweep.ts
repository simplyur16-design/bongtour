/**
 * hanatour 일1회 sweep — gw API 수집 + 0건 시 E2E(6개월) 검증 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-hanatour-sweep-cron.ts` (KST 05:00).
 *
 * REGRESSION-FREEZE[hanatour-sweep-e2e-recheck]: API→E2E·7일 재확인·stale 미래출발 정리 — manifest
 */
import type { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import {
  buildHanatourKstTargetMonths,
  validateHanatourAdminMonthYm,
} from '@/lib/hanatour-departures'
import { collectHanatourPriceInputsWithE2eFallback } from '@/lib/hanatour-price-collect'
import {
  clearHanatourPriceRecheckFromRawMeta,
  computeHanatourNextPriceRecheckYmd,
  isHanatourPriceRecheckDue,
  mergeHanatourPriceRecheckIntoRawMeta,
} from '@/lib/hanatour-price-recheck-meta'
import {
  addDaysUtcYmd,
  computePriceFromFromDepartureInputs,
  computeRuleAMarkersFromDepartureInputs,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'
import { resolveHanatourAdminE2eMonthsForward, departureInputToYmd } from '@/lib/scrape-date-bounds'
import { syncSupplierUrgentDealForProduct } from '@/lib/supplier-urgent-deal'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-hanatour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[hanatour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DUE_DAYS = 1
const SWEEP_DEFAULT_LIMIT = 200

export type HanatourSweepResult = {
  processed: number
  updated: number
  skipped: number
  pruned: number
  e2eCollected: number
  e2eAttempted: number
  urgentDealOn: number
  urgentDealOff: number
}

type SweepProductRow = {
  id: string
  originUrl: string | null
  originCode: string | null
  title: string | null
  originalTitle: string | null
  rawMeta: string | null
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

function monthYmsForHorizon(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const horizon = resolveHanatourAdminE2eMonthsForward()
  const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
  const ymSet = new Set<string>()
  let cur = lo
  for (let guard = 0; guard < 400 && cur <= hi; guard += 1) {
    const ym = cur.slice(0, 7)
    const validated = validateHanatourAdminMonthYm(ym)
    if (validated && allowedYm.has(validated)) ymSet.add(validated)
    const [y, m, d] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    cur = dt.toISOString().slice(0, 10)
  }
  return [...ymSet].sort()
}

function resolveDetailUrl(product: SweepProductRow): string | null {
  const stored = (product.originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (product.originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl('hanatour', code)
  return built.startsWith('http') ? built : null
}

function sourceDatesFromInputs(inputs: DepartureInput[], fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const dates = inputs
    .map((x) => departureInputToYmd(x.departureDate))
    .filter((d): d is string => d != null && d >= lo && d <= hi)
  return [...new Set(dates)]
}

async function findSweepProducts(
  prisma: PrismaClient,
  limit: number,
  options?: { productId?: string | null; originCode?: string | null },
  todayYmd?: string,
): Promise<SweepProductRow[]> {
  const select = {
    id: true,
    originUrl: true,
    originCode: true,
    title: true,
    originalTitle: true,
    rawMeta: true,
  } as const
  const today = todayYmd ?? kstTodayYmd()

  if (options?.productId?.trim()) {
    const row = await prisma.product.findFirst({
      where: {
        id: options.productId.trim(),
        registrationStatus: 'registered',
        originSource: 'hanatour',
      },
      select,
    })
    return row ? [row] : []
  }

  if (options?.originCode?.trim()) {
    const code = options.originCode.trim()
    const row = await prisma.product.findFirst({
      where: {
        registrationStatus: 'registered',
        originSource: 'hanatour',
        originCode: { equals: code, mode: 'insensitive' },
      },
      select,
    })
    return row ? [row] : []
  }

  const cutoff = new Date(Date.now() - SWEEP_DUE_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originSource: 'hanatour',
      OR: [{ lastSalesPolicyCheckedAt: null }, { lastSalesPolicyCheckedAt: { lt: cutoff } }],
    },
    orderBy: [{ lastSalesPolicyCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: limit * 3,
    select,
  })

  return rows.filter((p) => isHanatourPriceRecheckDue(p.rawMeta, today)).slice(0, limit)
}

async function pruneDeparturesOutsideSourceDates(
  prisma: PrismaClient,
  productId: string,
  fromYmd: string,
  toYmd: string,
  sourceDates: string[],
): Promise<number> {
  if (sourceDates.length === 0) return 0
  const notIn = [...new Set(sourceDates)].map(ymdToUtcMidnight)
  const deleted = await prisma.productDeparture.deleteMany({
    where: {
      productId,
      departureDate: {
        gte: ymdToUtcMidnight(fromYmd),
        lte: ymdToUtcMidnight(toYmd),
        notIn,
      },
    },
  })
  return deleted.count
}

/**
 * hanatour 등록 상품 일1회 sweep — API→E2E 가격 검증 + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueHanatourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productId?: string | null; originCode?: string | null },
): Promise<HanatourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options, todayYmd)

  const result: HanatourSweepResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    pruned: 0,
    e2eCollected: 0,
    e2eAttempted: 0,
    urgentDealOn: 0,
    urgentDealOff: 0,
  }

  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)
  const monthYms = monthYmsForHorizon(fromYmd, toYmd)

  for (const product of products) {
    result.processed += 1
    const now = new Date()

    try {
      const detailUrl = resolveDetailUrl(product)
      if (!detailUrl) {
        console.warn('[hanatour-sweep] skip-no-url', { productId: product.id })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearHanatourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      const registeredRawTitle =
        (product.originalTitle ?? '').trim() || (product.title ?? '').trim() || null

      const collected = await collectHanatourPriceInputsWithE2eFallback(
        detailUrl,
        fromYmd,
        toYmd,
        { monthYms, registeredRawTitle },
      )

      if (collected.source === 'e2e') {
        result.e2eCollected += 1
      }
      if (collected.e2eAttempted) {
        result.e2eAttempted += 1
      }

      if (collected.inputs.length === 0) {
        console.warn('[hanatour-sweep] collect-empty', {
          productId: product.id,
          e2eAttempted: collected.e2eAttempted,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearHanatourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      const inWindow = collected.inputs.filter((x) => {
        const dk = departureInputToYmd(x.departureDate)
        return dk != null && dk >= fromYmd && dk <= toYmd
      })

      await upsertProductDepartures(prisma, product.id, inWindow)

      const sourceDates = sourceDatesFromInputs(inWindow, fromYmd, toYmd)
      const prunedCount = await pruneDeparturesOutsideSourceDates(
        prisma,
        product.id,
        fromYmd,
        toYmd,
        sourceDates,
      )
      result.pruned += prunedCount

      const liveMarkers = computeRuleAMarkersFromDepartureInputs(inWindow, todayYmd)
      const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
        prisma,
        product.id,
        todayYmd,
        liveMarkers,
      )
      const priceFrom = computePriceFromFromDepartureInputs(inWindow, todayYmd)
      const urgentDeal = await syncSupplierUrgentDealForProduct(prisma, product.id, {
        todayYmd,
        now,
      })
      if (urgentDeal.turnedOn) result.urgentDealOn += 1
      if (urgentDeal.turnedOff) result.urgentDealOff += 1

      const nextRecheckYmd = computeHanatourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeHanatourPriceRecheckIntoRawMeta(product.rawMeta, {
        nextRecheckYmd,
        collectSource: collected.source!,
        horizonVerifiedAtIso: now.toISOString(),
      })

      await prisma.product.update({
        where: { id: product.id },
        data: {
          noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
          lastFutureDepartureDate: markers.lastFutureDepartureDate,
          ...(priceFrom != null ? { priceFrom } : {}),
          lastSalesPolicyCheckedAt: now,
          rawMeta,
        },
      })
      result.updated += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[hanatour-sweep] skip', {
        productId: product.id,
        message: msg.slice(0, 400),
      })
      await prisma.product.update({
        where: { id: product.id },
        data: { lastSalesPolicyCheckedAt: now },
      })
      result.skipped += 1
    }
  }

  if (result.updated > 0) {
    safeRevalidateProductListingCaches()
  }

  return result
}
