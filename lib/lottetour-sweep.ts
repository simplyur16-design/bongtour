/**
 * lottetour 일1회 sweep — evtListAjax HXR 수집 + 0건 시 E2E(180일) 검증 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-lottetour-sweep-cron.ts` (KST 07:00).
 *
 * REGRESSION-FREEZE[lottetour-sweep-e2e-recheck]: HXR→E2E·7일 재확인·stale 미래출발 정리 — manifest
 * REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
 */
import type { PrismaClient } from '@prisma/client'

import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import {
  clearLottetourPriceRecheckFromRawMeta,
  computeLottetourNextPriceRecheckYmd,
  isLottetourPriceRecheckDue,
  mergeLottetourPriceRecheckIntoRawMeta,
} from '@/lib/lottetour-price-recheck-meta'
import {
  collectLottetourPriceInputsWithE2eFallback,
  resolveLottetourCollectContext,
} from '@/lib/lottetour-price-collect'
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
import { computeDepartureSlotKeyFromInput } from '@/lib/departure-slot-key'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { syncSupplierUrgentDealForProduct } from '@/lib/supplier-urgent-deal'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-lottetour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[lottetour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DEFAULT_LIMIT = 200

export type LottetourSweepResult = {
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

function sourceSlotKeysFromInputs(inputs: DepartureInput[], fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const keys = inputs
    .filter((x) => {
      const dk = departureInputToYmd(x.departureDate)
      return dk != null && dk >= lo && dk <= hi
    })
    .map((x) => computeDepartureSlotKeyFromInput(x))
    .filter((k): k is string => k != null)
  return [...new Set(keys)]
}

async function pruneDeparturesOutsideSourceSlotKeys(
  prisma: PrismaClient,
  productId: string,
  fromYmd: string,
  toYmd: string,
  sourceSlotKeys: string[],
): Promise<number> {
  if (sourceSlotKeys.length === 0) return 0
  const deleted = await prisma.productDeparture.deleteMany({
    where: {
      productId,
      departureDate: {
        gte: ymdToUtcMidnight(fromYmd),
        lte: ymdToUtcMidnight(toYmd),
      },
      departureSlotKey: { notIn: [...new Set(sourceSlotKeys)] },
    },
  })
  return deleted.count
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
        originSource: 'lottetour',
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
        originSource: 'lottetour',
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
      originSource: 'lottetour',
      OR: [...supplierDailySweepDueOr(cutoff)],
    },
    orderBy: supplierDailySweepDueOrderBy(),
    take: limit * 3,
    select,
  })

  return rows.filter((p) => isLottetourPriceRecheckDue(p.rawMeta, today)).slice(0, limit)
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
  sourceSlotKeys: string[],
): Promise<number> {
  return pruneDeparturesOutsideSourceSlotKeys(prisma, productId, fromYmd, toYmd, sourceSlotKeys)
}

/**
 * lottetour 등록 상품 일1회 sweep — HXR→E2E 가격 검증 + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueLottetourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productId?: string | null; originCode?: string | null },
): Promise<LottetourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options, todayYmd)

  const result: LottetourSweepResult = {
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
      const resolved = await resolveLottetourCollectContext({
        originUrl: product.originUrl,
        originCode: product.originCode,
        rawMeta: product.rawMeta,
      })

      if (!resolved.ctx) {
        console.warn('[lottetour-sweep] skip-no-hints', {
          productId: product.id,
          warnings: resolved.warnings.slice(0, 3),
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearLottetourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      const collected = await collectLottetourPriceInputsWithE2eFallback(
        resolved.ctx,
        product.id,
        fromYmd,
        toYmd,
        { logLabel: `sweep:${product.id}` },
      )

      if (collected.source === 'e2e') {
        result.e2eCollected += 1
      }
      if (collected.e2eAttempted) {
        result.e2eAttempted += 1
      }

      if (collected.inputs.length === 0) {
        if (collected.horizonSoldOut) {
          const liveMarkers = computeRuleAMarkersFromDepartureInputs([], todayYmd)
          const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
            prisma,
            product.id,
            todayYmd,
            liveMarkers,
          )
          const prunedCount = await pruneAllDeparturesInHorizonWindow(
            prisma,
            product.id,
            fromYmd,
            toYmd,
          )
          result.pruned += prunedCount
          console.warn('[lottetour-sweep] horizon-sold-out', {
            productId: product.id,
            prunedCount,
          })
          await prisma.product.update({
            where: { id: product.id },
            data: {
              noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
              lastFutureDepartureDate: markers.lastFutureDepartureDate,
              ...(markers.marked ? { priceFrom: null } : {}),
              lastSalesPolicyCheckedAt: now,
              rawMeta: clearLottetourPriceRecheckFromRawMeta(product.rawMeta),
            },
          })
          result.horizonSoldOut += 1
          continue
        }

        console.warn('[lottetour-sweep] collect-empty', {
          productId: product.id,
          e2eAttempted: collected.e2eAttempted,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearLottetourPriceRecheckFromRawMeta(product.rawMeta),
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

      const sourceSlotKeys = sourceSlotKeysFromInputs(inWindow, fromYmd, toYmd)
      const prunedCount = await pruneDeparturesOutsideSourceDates(
        prisma,
        product.id,
        fromYmd,
        toYmd,
        sourceSlotKeys,
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

      const nextRecheckYmd = computeLottetourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeLottetourPriceRecheckIntoRawMeta(product.rawMeta, {
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
      console.warn('[lottetour-sweep] skip', {
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
