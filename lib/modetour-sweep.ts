/**
 * modetour 일1회 sweep — API 수집 + SD1·0건 시 E2E(6개월) 검증 + ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-modetour-sweep-cron.ts` (KST 04:00).
 *
 * REGRESSION-FREEZE[modetour-sweep-e2e-recheck]: API→E2E·7일 재확인·stale 미래출발 정리 — manifest
 *
 * SD1/API 0건: E2E로 6개월 지평 재확인. 둘 다 실패 시 지평 내 출발 삭제 후 auto_unpublished(자유여행 제외).
 * 수집 성공 시 `rawMeta.modetourNextPriceRecheckYmd` = KST 오늘 + 7일.
 */
import type { PrismaClient } from '@prisma/client'

import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import {
  isModetourSd1AutoUnpublishEligible,
  MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
} from '@/lib/modetour-sd1-policy'
import { collectModetourPriceInputsWithE2eFallback } from '@/lib/modetour-price-collect'
import {
  computeModetourNextPriceRecheckYmd,
  isModetourPriceRecheckDue,
  mergeModetourPriceRecheckIntoRawMeta,
  clearModetourPriceRecheckFromRawMeta,
} from '@/lib/modetour-price-recheck-meta'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  addDaysUtcYmd,
  computePriceFromFromDepartureInputs,
  computeRuleAMarkersFromDepartureInputs,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import {
  syncModetourUrgentDealForProduct,
} from '@/lib/modetour-urgent-deal'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-modetour'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const SWEEP_DUE_DAYS = 1
const SWEEP_DEFAULT_LIMIT = 200

export type ModetourSweepResult = {
  processed: number
  updated: number
  retired: number
  skipped: number
  pruned: number
  e2eCollected: number
  urgentDealOn: number
  urgentDealOff: number
}

type SweepProductRow = {
  id: string
  originUrl: string | null
  listingKind: string | null
  productType: string | null
  rawMeta: string | null
}

/** @deprecated `isModetourSd1AutoUnpublishEligible` — 회귀 테스트 호환 alias */
export function shouldModetourSweepRetireOnSd1(
  product: {
    listingKind?: string | null
    productType?: string | null
  },
  options?: { hasFuturePricedDeparture?: boolean },
): boolean {
  return isModetourSd1AutoUnpublishEligible(product, options)
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

async function findSweepProducts(
  prisma: PrismaClient,
  limit: number,
  productNo?: string | null,
  todayYmd?: string,
): Promise<SweepProductRow[]> {
  const select = {
    id: true,
    originUrl: true,
    listingKind: true,
    productType: true,
    rawMeta: true,
  } as const
  const today = todayYmd ?? kstTodayYmd()

  if (productNo?.trim()) {
    const forcedNo = productNo.trim()
    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        originSource: 'modetour',
      },
      select,
    })
    return rows
      .filter((p) => parseModetourPackageProductNoFromUrl(p.originUrl) === forcedNo)
      .slice(0, 1)
  }

  const cutoff = new Date(Date.now() - SWEEP_DUE_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originSource: 'modetour',
      OR: [{ lastSalesPolicyCheckedAt: null }, { lastSalesPolicyCheckedAt: { lt: cutoff } }],
    },
    orderBy: [{ lastSalesPolicyCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: limit * 3,
    select,
  })

  return rows
    .filter((p) => isModetourPriceRecheckDue(p.rawMeta, today))
    .slice(0, limit)
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

async function clearHorizonDepartures(
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

/**
 * modetour 등록 상품 일1회 sweep — API→E2E 가격 검증 + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueModetourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productNo?: string | null }
): Promise<ModetourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(prisma, limit, options?.productNo ?? null, todayYmd)

  const result: ModetourSweepResult = {
    processed: 0,
    updated: 0,
    retired: 0,
    skipped: 0,
    pruned: 0,
    e2eCollected: 0,
    urgentDealOn: 0,
    urgentDealOff: 0,
  }

  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  for (const product of products) {
    result.processed += 1
    const now = new Date()

    try {
      const collected = await collectModetourPriceInputsWithE2eFallback(
        product.originUrl,
        fromYmd,
        toYmd,
      )

      if (collected.source === 'e2e') {
        result.e2eCollected += 1
      }

      if (collected.inputs.length === 0) {
        const prunedOnFail = await clearHorizonDepartures(prisma, product.id, fromYmd, toYmd)
        result.pruned += prunedOnFail

        if (!isModetourSd1AutoUnpublishEligible(product)) {
          console.warn('[modetour-sweep] collect-fail-skip-unpublish', {
            productId: product.id,
            apiFailedSd1: collected.apiFailedSd1,
            e2eError: collected.e2eError,
            listingKind: product.listingKind,
            productType: product.productType,
          })
          await prisma.product.update({
            where: { id: product.id },
            data: {
              lastSalesPolicyCheckedAt: now,
              rawMeta: clearModetourPriceRecheckFromRawMeta(product.rawMeta),
            },
          })
          result.skipped += 1
          continue
        }

        const liveMarkers = computeRuleAMarkersFromDepartureInputs([], todayYmd)
        const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
          prisma,
          product.id,
          todayYmd,
          liveMarkers,
        )

        await prisma.product.update({
          where: { id: product.id },
          data: {
            registrationStatus: 'auto_unpublished',
            autoUnpublishedReason: MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
            autoUnpublishedAt: now,
            noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt ?? now,
            lastFutureDepartureDate: markers.lastFutureDepartureDate,
            lastSalesPolicyCheckedAt: now,
            rawMeta: clearModetourPriceRecheckFromRawMeta(product.rawMeta),
          },
        })
        result.retired += 1
        continue
      }

      const inWindow = collected.inputs.filter((x) => {
        const dk = departureInputToYmd(x.departureDate)
        return dk != null && dk >= fromYmd && dk <= toYmd
      })

      await upsertProductDepartures(prisma, product.id, inWindow)

      const prunedCount = await pruneDeparturesOutsideSourceDates(
        prisma,
        product.id,
        fromYmd,
        toYmd,
        collected.sourceDates,
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
      const urgentDeal = await syncModetourUrgentDealForProduct(prisma, product.id, {
        todayYmd,
        now,
      })
      if (urgentDeal.turnedOn) result.urgentDealOn += 1
      if (urgentDeal.turnedOff) result.urgentDealOff += 1

      const nextRecheckYmd = computeModetourNextPriceRecheckYmd(todayYmd)
      const rawMeta = mergeModetourPriceRecheckIntoRawMeta(product.rawMeta, {
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
      console.warn('[modetour-sweep] skip', {
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

  if (result.retired > 0) {
    revalidateProductListingCaches()
  }

  return result
}
