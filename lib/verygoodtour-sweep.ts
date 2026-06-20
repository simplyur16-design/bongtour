/**
 * verygoodtour 일1회 sweep — ProductCalendarSearch HXR 수집 + 0건 시 E2E(180일) 검증 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-verygoodtour-sweep-cron.ts` (KST 08:00).
 *
 * REGRESSION-FREEZE[verygoodtour-sweep-e2e-recheck]: HXR→E2E·7일 재확인·stale 미래출발 정리 — manifest
 */
import type { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import {
  addDaysUtcYmd,
  computePriceFromFromDepartureInputs,
  computeRuleAMarkersFromDepartureInputs,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { syncSupplierUrgentDealForProduct } from '@/lib/supplier-urgent-deal'
import { normalizeVerygoodtourDetailUrlForCollect } from '@/lib/verygoodtour-detail-url-health'
import { collectVerygoodtourPriceInputsWithE2eFallback } from '@/lib/verygoodtour-price-collect'
import {
  clearVerygoodtourPriceRecheckFromRawMeta,
  computeVerygoodtourNextPriceRecheckYmd,
  isVerygoodtourPriceRecheckDue,
  mergeVerygoodtourPriceRecheckIntoRawMeta,
} from '@/lib/verygoodtour-price-recheck-meta'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-verygoodtour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[verygoodtour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DUE_DAYS = 1
const SWEEP_DEFAULT_LIMIT = 200

export type VerygoodtourSweepResult = {
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

function resolveDetailUrl(product: SweepProductRow): string | null {
  const stored = (product.originUrl ?? '').trim()
  let base: string | null = null
  if (stored.startsWith('http')) base = stored
  else {
    const code = (product.originCode ?? '').trim()
    if (!code) return null
    const built = buildDetailUrl('verygoodtour', code)
    base = built.startsWith('http') ? built : null
  }
  if (!base) return null
  return normalizeVerygoodtourDetailUrlForCollect(base)
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
        originSource: 'verygoodtour',
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
        originSource: 'verygoodtour',
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
      originSource: 'verygoodtour',
      OR: [{ lastSalesPolicyCheckedAt: null }, { lastSalesPolicyCheckedAt: { lt: cutoff } }],
    },
    orderBy: [{ lastSalesPolicyCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: limit * 3,
    select,
  })

  return rows.filter((p) => isVerygoodtourPriceRecheckDue(p.rawMeta, today)).slice(0, limit)
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

/**
 * verygoodtour 등록 상품 일1회 sweep — HXR→E2E 가격 검증 + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueVerygoodtourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productId?: string | null; originCode?: string | null },
): Promise<VerygoodtourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options, todayYmd)

  const result: VerygoodtourSweepResult = {
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
      const detailUrl = resolveDetailUrl(product)
      if (!detailUrl) {
        console.warn('[verygoodtour-sweep] skip-no-url', { productId: product.id })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearVerygoodtourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      const collected = await collectVerygoodtourPriceInputsWithE2eFallback(detailUrl, fromYmd, toYmd)

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
          console.warn('[verygoodtour-sweep] horizon-sold-out', {
            productId: product.id,
            prunedCount,
          })
          await prisma.product.update({
            where: { id: product.id },
            data: {
              noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt ?? now,
              lastFutureDepartureDate: markers.lastFutureDepartureDate,
              priceFrom: null,
              lastSalesPolicyCheckedAt: now,
              rawMeta: clearVerygoodtourPriceRecheckFromRawMeta(product.rawMeta),
            },
          })
          result.horizonSoldOut += 1
          continue
        }

        console.warn('[verygoodtour-sweep] collect-empty', {
          productId: product.id,
          e2eAttempted: collected.e2eAttempted,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearVerygoodtourPriceRecheckFromRawMeta(product.rawMeta),
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

      const nextRecheckYmd = computeVerygoodtourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeVerygoodtourPriceRecheckIntoRawMeta(product.rawMeta, {
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
      console.warn('[verygoodtour-sweep] skip', {
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
