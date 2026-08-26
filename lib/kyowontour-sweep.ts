/**
 * kyowontour 일1회 sweep — differentDepartDate AJAX + E2E 폴백 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-kyowontour-sweep-cron.ts` (KST 08:30).
 *
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]: AJAX→E2E·7일 재확인·stale 미래출발 정리 — manifest
 * REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
 */
import type { PrismaClient } from '@prisma/client'

import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import { collectKyowontourPriceInputsWithE2eFallback } from '@/lib/kyowontour-price-collect'
import {
  clearKyowontourPriceRecheckFromRawMeta,
  computeKyowontourNextPriceRecheckYmd,
  isKyowontourPriceRecheckDue,
  mergeKyowontourPriceRecheckIntoRawMeta,
} from '@/lib/kyowontour-price-recheck-meta'
import {
  addDaysUtcYmd,
  computePriceFromFromDepartureInputs,
  computeRuleAMarkersFromDepartureInputs,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'
import {
  supplierDailySweepDueCutoff,
  supplierDailySweepDueOr,
  supplierDailySweepDueOrderBy,
} from '@/lib/supplier-daily-sweep-due'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { syncSupplierUrgentDealForProduct } from '@/lib/supplier-urgent-deal'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-kyowontour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[kyowontour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DEFAULT_LIMIT = 200

export type KyowontourSweepResult = {
  processed: number
  updated: number
  skipped: number
  pruned: number
  e2eCollected: number
  e2eAttempted: number
  horizonSoldOut: number
  urgentDealOn: number
  urgentDealOff: number
}

type SweepProductRow = {
  id: string
  originUrl: string | null
  originCode: string | null
  rawMeta: string | null
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
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
    rawMeta: true,
  } as const
  const today = todayYmd ?? kstTodayYmd()

  if (options?.productId?.trim()) {
    const row = await prisma.product.findFirst({
      where: {
        id: options.productId.trim(),
        registrationStatus: 'registered',
        originSource: 'kyowontour',
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
        originSource: 'kyowontour',
        originCode: { equals: code, mode: 'insensitive' },
      },
      select,
    })
    return row ? [row] : []
  }

  const cutoff = supplierDailySweepDueCutoff()
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originSource: 'kyowontour',
      OR: [...supplierDailySweepDueOr(cutoff)],
    },
    orderBy: supplierDailySweepDueOrderBy(),
    take: limit * 3,
    select,
  })

  return rows.filter((p) => isKyowontourPriceRecheckDue(p.rawMeta, today)).slice(0, limit)
}

async function pruneAllDeparturesInHorizonWindow(
  prisma: PrismaClient,
  productId: string,
  fromYmd: string,
  toYmd: string,
): Promise<number> {
  const deleted = await prisma.productDeparture.deleteMany({
    where: {
      productId,
      departureDate: {
        gte: ymdToUtcMidnight(fromYmd),
        lte: ymdToUtcMidnight(toYmd),
      },
    },
  })
  return deleted.count
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

export async function sweepDueKyowontourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productId?: string | null; originCode?: string | null },
): Promise<KyowontourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options, todayYmd)

  const result: KyowontourSweepResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    pruned: 0,
    e2eCollected: 0,
    e2eAttempted: 0,
    horizonSoldOut: 0,
    urgentDealOn: 0,
    urgentDealOff: 0,
  }

  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  for (const product of products) {
    result.processed += 1
    const now = new Date()

    try {
      const collected = await collectKyowontourPriceInputsWithE2eFallback(product, fromYmd, toYmd)

      if (collected.source === 'e2e') result.e2eCollected += 1
      if (collected.e2eAttempted) result.e2eAttempted += 1

      if (collected.inputs.length === 0) {
        if (collected.horizonSoldOut) {
          const liveMarkers = computeRuleAMarkersFromDepartureInputs([], todayYmd)
          const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
            prisma,
            product.id,
            todayYmd,
            liveMarkers,
          )
          const prunedCount = await pruneAllDeparturesInHorizonWindow(prisma, product.id, fromYmd, toYmd)
          result.pruned += prunedCount
          console.warn('[kyowontour-sweep] horizon-sold-out', { productId: product.id, prunedCount })
          await prisma.product.update({
            where: { id: product.id },
            data: {
              noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
              lastFutureDepartureDate: markers.lastFutureDepartureDate,
              ...(markers.marked ? { priceFrom: null } : {}),
              lastSalesPolicyCheckedAt: now,
              rawMeta: clearKyowontourPriceRecheckFromRawMeta(product.rawMeta),
            },
          })
          result.horizonSoldOut += 1
          continue
        }

        console.warn('[kyowontour-sweep] collect-empty', {
          productId: product.id,
          e2eAttempted: collected.e2eAttempted,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearKyowontourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      await upsertProductDepartures(prisma, product.id, collected.inputs)

      const sourceDates = sourceDatesFromInputs(collected.inputs, fromYmd, toYmd)
      const prunedCount = await pruneDeparturesOutsideSourceDates(
        prisma,
        product.id,
        fromYmd,
        toYmd,
        sourceDates,
      )
      result.pruned += prunedCount

      const liveMarkers = computeRuleAMarkersFromDepartureInputs(collected.inputs, todayYmd)
      const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
        prisma,
        product.id,
        todayYmd,
        liveMarkers,
      )
      const priceFrom = computePriceFromFromDepartureInputs(collected.inputs, todayYmd)
      const urgentDeal = await syncSupplierUrgentDealForProduct(prisma, product.id, { todayYmd, now })
      if (urgentDeal.turnedOn) result.urgentDealOn += 1
      if (urgentDeal.turnedOff) result.urgentDealOff += 1

      const nextRecheckYmd = computeKyowontourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeKyowontourPriceRecheckIntoRawMeta(product.rawMeta, {
        nextRecheckYmd,
        collectSource: collected.source ?? 'ajax',
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
      console.warn('[kyowontour-sweep] skip', { productId: product.id, message: msg.slice(0, 400) })
      await prisma.product.update({
        where: { id: product.id },
        data: { lastSalesPolicyCheckedAt: now },
      })
      result.skipped += 1
    }
  }

  if (result.updated > 0) safeRevalidateProductListingCaches()

  return result
}
