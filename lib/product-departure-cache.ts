/**
 * Product.lastFutureDepartureDate(마지막 출발일 캐시) SSOT — 실제 ProductDeparture row 에서 다시 계산.
 *
 * 공급사 라이브 fetch 결과로 캐시를 쓰면(sweep·5분 정책 점검) 이미 지난 출발이 캐시에 늦게 남거나
 * 캐시가 비어 있는 채로 공개된다. 출발 row 를 쓰는 모든 경로는 쓰기 직후 이 모듈로 캐시를 맞춘다.
 *
 * - 캐시 = 오늘(KST, 포함) 이후 성인가 > 0 인 출발 row 의 MAX(departureDate). 없으면 null.
 * - 미래 성인가 row 가 있으면 noFutureDepartureConfirmedAt 마커는 해제. row 가 없을 때는 마커를 건드리지 않는다
 *   (마커는 룰 A 라이브 확인 SSOT — 퍼지·6개월 검증 입력).
 * - 국외연수(overseas_training, slug otr-*) 는 고정 요일 출발이라 출발 row 가 없을 수 있어 재계산 대상이 아니다.
 *
 * REGRESSION-FREEZE[departure-cache-from-rows]: 캐시는 출발 row 에서 재계산, 공개는 fail-closed — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { kstTodayYmd } from '@/lib/calendar-ymd'
import { maxFuturePricedDepartureDate } from '@/lib/future-priced-departure-guard'

/** 국외연수(otr) listingKind — 캐시 fail-closed 예외. `overseas-training-program-query` 와 같은 값(Prisma 미임포트용 복제). */
export const DEPARTURE_CACHE_OTR_LISTING_KIND = 'overseas_training' as const

export function isOverseasTrainingListingKind(listingKind: string | null | undefined): boolean {
  return (listingKind ?? '').trim() === DEPARTURE_CACHE_OTR_LISTING_KIND
}

export type DepartureCacheState = {
  lastFutureDepartureDate: Date | null
  noFutureDepartureConfirmedAt: Date | null
}

export type DepartureCachePlan = {
  changed: boolean
  /** 쓸 캐시 값(실제 출발 row MAX). */
  nextLastFutureDepartureDate: Date | null
  /** true 면 마커를 null 로 해제. */
  clearMarker: boolean
}

function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a == null || b == null) return a == null && b == null
  return a.getTime() === b.getTime()
}

/** 순수 판정: 현재 캐시/마커 vs 실제 출발 row 의 MAX. */
export function planDepartureCache(current: DepartureCacheState, actualLast: Date | null): DepartureCachePlan {
  const clearMarker = actualLast != null && current.noFutureDepartureConfirmedAt != null
  const changed = !sameInstant(current.lastFutureDepartureDate, actualLast) || clearMarker
  return { changed, nextLastFutureDepartureDate: actualLast, clearMarker }
}

function toYmd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

export type DepartureCacheRecomputeResult = {
  productId: string
  /** conflict = 읽은 뒤 다른 쓰기가 먼저 캐시/마커를 바꿔 조건부 UPDATE 가 0건(덮어쓰지 않음). */
  status: 'updated' | 'unchanged' | 'skipped_otr' | 'not_found' | 'conflict'
  dryRun: boolean
  before: { lastFutureDepartureDate: string | null; noFutureDepartureConfirmedAt: string | null }
  after: { lastFutureDepartureDate: string | null; markerCleared: boolean }
}

/**
 * 한 상품의 캐시를 실제 출발 row 에서 다시 계산해 바뀐 경우에만 쓴다.
 * 변경 전 값은 결과(before)에 남겨 되돌리기 기록으로 쓸 수 있다.
 */
export async function recomputeProductDepartureCache(
  prisma: PrismaClient,
  productId: string,
  opts?: { todayYmd?: string; dryRun?: boolean },
): Promise<DepartureCacheRecomputeResult> {
  const dryRun = opts?.dryRun === true
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { listingKind: true, lastFutureDepartureDate: true, noFutureDepartureConfirmedAt: true },
  })
  const empty = { lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }
  if (!row) {
    return {
      productId,
      status: 'not_found',
      dryRun,
      before: empty,
      after: { lastFutureDepartureDate: null, markerCleared: false },
    }
  }
  const before = {
    lastFutureDepartureDate: toYmd(row.lastFutureDepartureDate),
    noFutureDepartureConfirmedAt: row.noFutureDepartureConfirmedAt?.toISOString() ?? null,
  }
  if (isOverseasTrainingListingKind(row.listingKind)) {
    return {
      productId,
      status: 'skipped_otr',
      dryRun,
      before,
      after: { lastFutureDepartureDate: before.lastFutureDepartureDate, markerCleared: false },
    }
  }

  const todayYmd = opts?.todayYmd ?? kstTodayYmd()
  const actualLast = await maxFuturePricedDepartureDate(prisma, productId, todayYmd)
  const plan = planDepartureCache(row, actualLast)
  let conflict = false
  if (plan.changed && !dryRun) {
    // REGRESSION-FREEZE[departure-cache-from-rows]: 읽은 값 그대로일 때만 쓰는 조건부 UPDATE(동시 저장이 쓴 새 캐시를 옛 값으로 덮지 않음) — manifest
    const res = await prisma.product.updateMany({
      where: {
        id: productId,
        lastFutureDepartureDate: row.lastFutureDepartureDate,
        noFutureDepartureConfirmedAt: row.noFutureDepartureConfirmedAt,
      },
      data: {
        lastFutureDepartureDate: plan.nextLastFutureDepartureDate,
        ...(plan.clearMarker ? { noFutureDepartureConfirmedAt: null } : {}),
      },
    })
    conflict = res.count === 0
  }
  return {
    productId,
    status: conflict ? 'conflict' : plan.changed ? 'updated' : 'unchanged',
    dryRun,
    before,
    after: { lastFutureDepartureDate: toYmd(plan.nextLastFutureDepartureDate), markerCleared: plan.clearMarker },
  }
}

/**
 * 출발 row 쓰기 경로에서 쓰는 안전판 — 실패해도 수집·등록 흐름은 막지 않는다(야간 점검이 다시 맞춘다).
 */
export async function recomputeProductDepartureCacheSafe(
  prisma: PrismaClient,
  productId: string,
  label: string,
): Promise<DepartureCacheRecomputeResult | null> {
  try {
    return await recomputeProductDepartureCache(prisma, productId)
  } catch (e) {
    console.warn('[departure-cache] recompute failed', {
      label,
      productId,
      message: (e instanceof Error ? e.message : String(e)).slice(0, 300),
    })
    return null
  }
}
