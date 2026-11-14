/**
 * naeiltour 일1회 가격 sweep — program_process 수집 → ProductDeparture upsert.
 * instrumentation: `lib/instrumentation-naeiltour-sweep-cron.ts` (KST 09:30).
 *
 * 새 가격 계산 로직 없음. 수집 0건·실패 시 기존 가격 유지(collect-fail-skip).
 * REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { recomputeProductDepartureCacheSafe } from '@/lib/product-departure-cache'
import { createSupplierSweepPacer } from '@/lib/supplier-sweep-pacing'

import { prismaRead as defaultPrismaRead } from '@/lib/prisma'
import {
  collectNaeiltourProgramProcessDeparturesForGoodCd,
  collectNaeiltourProgramProcessDeparturesForUrl,
  type NaeiltourCalendarRow,
} from '@/lib/naeiltour-departures'
import { parseNaeiltourGoodCdFromUrl } from '@/lib/naeiltour-http'
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
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-naeiltour'

function safeRevalidateProductListingCaches(): void {
  try {
    revalidateProductListingCaches()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn('[naeiltour-sweep] skip revalidate (not in Next.js runtime)')
      return
    }
    throw err
  }
}

const SWEEP_DEFAULT_LIMIT = 200

/**
 * 자동 재수집 대상. 등록 완료뿐 아니라 등록대기·사진전 검수도 포함한다.
 * pre_photo_blocked·pending 을 빼면 공급사에 미래 출발이 있어도 ProductDeparture 가 비어 있는 채로 남는다.
 * REGRESSION-FREEZE[naeiltour-sweep-pending-departures]: pending·pre_photo_blocked 도 program_process — manifest
 */
export const NAEILTOUR_SWEEP_REGISTRATION_STATUSES = ['registered', 'pending', 'pre_photo_blocked'] as const

function naeiltourSweepStatusWhere() {
  return { registrationStatus: { in: [...NAEILTOUR_SWEEP_REGISTRATION_STATUSES] } }
}

export type NaeiltourSweepResult = {
  processed: number
  updated: number
  skipped: number
}

type SweepProductRow = {
  id: string
  originUrl: string | null
  originCode: string | null
}

function calendarRowsToDepartureInputs(rows: NaeiltourCalendarRow[]): DepartureInput[] {
  return rows.map((r) => ({
    departureDate: r.departDate,
    adultPrice: r.adultPrice,
    statusRaw: r.statusRaw ?? undefined,
    seatsStatusRaw: r.seatsStatusRaw ?? undefined,
    seatCount: r.seatCount ?? undefined,
    carrierName: r.carrierName ?? undefined,
    supplierDepartureCodeCandidate: r.eventSeq ?? undefined,
  }))
}

async function findSweepProducts(
  prisma: PrismaClient,
  limit: number,
  options?: { productId?: string | null; originCode?: string | null },
): Promise<SweepProductRow[]> {
  const select = {
    id: true,
    originUrl: true,
    originCode: true,
  } as const

  if (options?.productId?.trim()) {
    const row = await prisma.product.findFirst({
      where: {
        id: options.productId.trim(),
        ...naeiltourSweepStatusWhere(),
        originSource: 'naeiltour',
      },
      select,
    })
    return row ? [row] : []
  }

  if (options?.originCode?.trim()) {
    const code = options.originCode.trim()
    const row = await prisma.product.findFirst({
      where: {
        ...naeiltourSweepStatusWhere(),
        originSource: 'naeiltour',
        originCode: { equals: code, mode: 'insensitive' },
      },
      select,
    })
    return row ? [row] : []
  }

  const cutoff = supplierDailySweepDueCutoff()
  return prisma.product.findMany({
    where: {
      ...naeiltourSweepStatusWhere(),
      originSource: 'naeiltour',
      OR: [...supplierDailySweepDueOr(cutoff)],
    },
    orderBy: supplierDailySweepDueOrderBy(),
    take: limit,
    select,
  })
}

/**
 * naeiltour 등록 상품 일1회 가격 sweep.
 */
export async function sweepDueNaeiltourProducts(
  prisma: PrismaClient,
  options?: {
    limit?: number
    productId?: string | null
    originCode?: string | null
    prismaRead?: PrismaClient
    /** 테스트용 collect 주입 */
    collectForProduct?: (product: SweepProductRow, fromYmd: string, toYmd: string) => Promise<NaeiltourCalendarRow[]>
  },
): Promise<NaeiltourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? SWEEP_DEFAULT_LIMIT))
  const todayYmd = kstTodayYmd()
  const products = await findSweepProducts(
    options?.prismaRead ?? defaultPrismaRead,
    limit,
    options,
  )

  const result: NaeiltourSweepResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
  }

  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  // REGRESSION-FREEZE[supplier-sweep-pacing]: 상품 간 딜레이 + 거절 연속 시 중단·알림
  const pacer = createSupplierSweepPacer('naeiltour')
  for (const product of products) {
    if (!(await pacer.beforeProduct())) break
    result.processed += 1
    const now = new Date()

    try {
      let rows: NaeiltourCalendarRow[]
      if (options?.collectForProduct) {
        rows = await options.collectForProduct(product, fromYmd, toYmd)
      } else {
        const url = (product.originUrl ?? '').trim()
        const code = (product.originCode ?? '').trim() || parseNaeiltourGoodCdFromUrl(url) || ''
        if (url.startsWith('http')) {
          rows = await collectNaeiltourProgramProcessDeparturesForUrl(url, { fromYmd, toYmd })
        } else if (code) {
          rows = await collectNaeiltourProgramProcessDeparturesForGoodCd(code, { fromYmd, toYmd })
        } else {
          console.warn('[naeiltour-sweep] collect-fail-skip', {
            productId: product.id,
            reason: 'no-url-or-code',
          })
          await prisma.product.update({
            where: { id: product.id },
            data: { lastSalesPolicyCheckedAt: now },
          })
          result.skipped += 1
          continue
        }
      }

      if (!rows.length) {
        console.warn('[naeiltour-sweep] collect-fail-skip', {
          productId: product.id,
          reason: 'empty-rows',
        })
        await prisma.product.update({
          where: { id: product.id },
          data: { lastSalesPolicyCheckedAt: now },
        })
        result.skipped += 1
        continue
      }

      const inputs = calendarRowsToDepartureInputs(rows)
      const upserted = await upsertProductDepartures(prisma, product.id, inputs)
      if (upserted <= 0) {
        console.warn('[naeiltour-sweep] collect-fail-skip', {
          productId: product.id,
          reason: 'upsert-zero',
        })
        await prisma.product.update({
          where: { id: product.id },
          data: { lastSalesPolicyCheckedAt: now },
        })
        result.skipped += 1
        continue
      }

      const markers = computeRuleAMarkersFromDepartureInputs(inputs, todayYmd)
      const priceFrom = computePriceFromFromDepartureInputs(inputs, todayYmd)
      await prisma.product.update({
        where: { id: product.id },
        data: {
          ...(priceFrom != null ? { priceFrom } : {}),
          noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
          lastFutureDepartureDate: markers.lastFutureDepartureDate,
          lastSalesPolicyCheckedAt: now,
        },
      })
      // REGRESSION-FREEZE[departure-cache-from-rows]: 출발 row 쓰기·마커 갱신 직후 캐시 재계산 — manifest
      await recomputeProductDepartureCacheSafe(prisma, product.id, 'naeiltour-sweep:updated')
      result.updated += 1
    } catch (e) {
      await pacer.onError(e)
      console.warn('[naeiltour-sweep] collect-fail-skip', {
        productId: product.id,
        reason: e instanceof Error ? e.message : String(e),
      })
      try {
        await prisma.product.update({
          where: { id: product.id },
          data: { lastSalesPolicyCheckedAt: now },
        })
      } catch {
        /* ignore */
      }
      result.skipped += 1
    }
  }

  if (result.updated > 0) safeRevalidateProductListingCaches()
  return result
}
