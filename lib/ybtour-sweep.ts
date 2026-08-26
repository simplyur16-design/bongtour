/**
 * ybtour 일1회 sweep — papi by-goods 월 API 수집 + 0건 시 E2E(6개월) 검증 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-ybtour-sweep-cron.ts` (KST 06:00).
 *
 * REGRESSION-FREEZE[ybtour-sweep-e2e-recheck]: API→E2E·7일 재확인·stale 미래출발 정리 — manifest
 * REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
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
import {
  supplierDailySweepDueCutoff,
  supplierDailySweepDueOr,
  supplierDailySweepDueOrderBy,
} from '@/lib/supplier-daily-sweep-due'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { syncSupplierUrgentDealForProduct } from '@/lib/supplier-urgent-deal'
import { collectYbtourPriceInputsWithE2eFallback } from '@/lib/ybtour-price-collect'
import {
  clearYbtourPriceRecheckFromRawMeta,
  computeYbtourNextPriceRecheckYmd,
  isYbtourPriceRecheckDue,
  mergeYbtourPriceRecheckIntoRawMeta,
} from '@/lib/ybtour-price-recheck-meta'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-ybtour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[ybtour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DEFAULT_LIMIT = 200

export type YbtourSweepResult = {
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

function withYbtourGoodsCdParam(detailUrl: string, originCode: string | null): string {
  const code = (originCode ?? '').trim()
  if (!code) return detailUrl
  try {
    const u = new URL(detailUrl)
    if (!/prdt\.ybtour\.co\.kr$/i.test(u.hostname)) return detailUrl
    if (!u.pathname.includes('detailPackage')) return detailUrl
    const hasGoods = Boolean(u.searchParams.get('goodsCd')?.trim() || u.searchParams.get('goodscd')?.trim())
    if (hasGoods) return detailUrl
    u.searchParams.set('goodsCd', code)
    if (!u.searchParams.get('menu')?.trim()) u.searchParams.set('menu', 'PKG')
    return u.toString()
  } catch {
    return detailUrl
  }
}

function resolveDetailUrl(product: SweepProductRow): string | null {
  const stored = (product.originUrl ?? '').trim()
  let base: string | null = null
  if (stored.startsWith('http')) base = stored
  else {
    const code = (product.originCode ?? '').trim()
    if (!code) return null
    const built = buildDetailUrl('ybtour', code)
    base = built.startsWith('http') ? built : null
  }
  if (!base) return null
  return withYbtourGoodsCdParam(base, product.originCode)
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
        originSource: 'ybtour',
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
        originSource: 'ybtour',
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
      originSource: 'ybtour',
      OR: [...supplierDailySweepDueOr(cutoff)],
    },
    orderBy: supplierDailySweepDueOrderBy(),
    take: limit * 3,
    select,
  })

  return rows.filter((p) => isYbtourPriceRecheckDue(p.rawMeta, today)).slice(0, limit)
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
 * ybtour 등록 상품 일1회 sweep — API→E2E 가격 검증 + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueYbtourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productId?: string | null; originCode?: string | null },
): Promise<YbtourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options, todayYmd)

  const result: YbtourSweepResult = {
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
        console.warn('[ybtour-sweep] skip-no-url', { productId: product.id })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearYbtourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.skipped += 1
        continue
      }

      const collected = await collectYbtourPriceInputsWithE2eFallback(
        detailUrl,
        product.originCode,
        fromYmd,
        toYmd,
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
          console.warn('[ybtour-sweep] horizon-sold-out', {
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
              rawMeta: clearYbtourPriceRecheckFromRawMeta(product.rawMeta),
            },
          })
          result.horizonSoldOut += 1
          continue
        }

        console.warn('[ybtour-sweep] collect-empty', {
          productId: product.id,
          e2eAttempted: collected.e2eAttempted,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: {
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearYbtourPriceRecheckFromRawMeta(product.rawMeta),
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

      const nextRecheckYmd = computeYbtourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeYbtourPriceRecheckIntoRawMeta(product.rawMeta, {
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
      console.warn('[ybtour-sweep] skip', {
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
