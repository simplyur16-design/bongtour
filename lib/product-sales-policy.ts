/**
 * 트랙 ⑥ 상품 노출·판매 정책 — 5분 cron 라이브 검증 모듈.
 *
 * 호출자:
 *  - `lib/instrumentation-product-sales-policy-cron.ts` (5분 인터벌, 상품 1개 처리) — 2-C
 *  - 8 노출 경로 (browse / featured / sitemap / sitemap-images / gallery / product detail × 2 / home-hub) — 2-E
 *
 * 정책 SSOT:
 *  - 룰 A — 향후 90일(3개월) 라이브 fetch 결과로 마커·lastFuture 갱신.
 *           라이브 0건이어도 **DB에 오늘 이후 성인가 출발이 있으면** 마커 부착 안 함.
 *  - 룰 B — `lastFutureDepartureDate < NOW() + 3d` 이면 사용자 노출 제외
 *           (마지막 출발 3일 전까지 노출, 2일 남으면 공개 목록/상세에서 제외).
 *           마커만 있고 lastFuture 없으면(미래 출발 0) 즉시 제외.
 *
 * 봇 차단 회피 — 트랙 ⑤ B' 가드(`waitForSupplierThrottle`/`acquireSupplierLock`/
 *   `humanDelayBeforeScrape`/`recordSupplierStart`/`recordSupplierFinished`)를 import 재사용.
 *   `executeRangeOnDemandDepartures`(`windowDays` cap 31) 는 우회 — 1.7 결정에 따라 5공급사 분기 함수를
 *   본 모듈에서 직접 호출(라이브 fetch 룰 A 윈도우 1회).
 *
 * 본 모듈은 ProductDeparture upsert 를 하지 않는다.
 *  - 라이브 fetch 결과는 `lastFutureDepartureDate` 캐시 + 룰 A 마커 갱신에만 사용.
 *  - 가격 동기화는 cron 야간 배치(`runCalendarPriceBatchInline`) + on-demand 흐름 SSOT 그대로.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import {
  buildDetailUrl,
  collectYbtourDepartureInputsForDateRange,
  mapScrapedRowsToInputs,
  scrapeLiveCalendar,
} from '@/lib/admin-departure-rescrape'
import { collectHanatourDepartureInputsForDateRange } from '@/lib/hanatour-departures'
import {
  buildLottetourEvtDetailUrl,
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import {
  brandKeyResolvesToYbtour,
  normalizeBrandKeyToCanonicalSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { hasPricedFutureDepartureInput } from '@/lib/product-six-month-price-verification'
import { departureInputToYmd, filterDepartureInputsOnOrAfterCalendarToday } from '@/lib/scrape-date-bounds'
import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import { addDaysUtcYmd, kstTodayYmd } from '@/lib/calendar-ymd'
import {
  acquireSupplierLock,
  humanDelayBeforeScrape,
  recordSupplierFinished,
  recordSupplierStart,
  waitForSupplierThrottle,
} from '@/lib/scraper-on-demand-throttle'

// ---------------------------------------------------------------------------
// 정책 상수
// ---------------------------------------------------------------------------

/** 룰 A — 미래 출발일 탐색/수집 범위 (today ~ today + N일). 3개월. */
export const RULE_A_WINDOW_DAYS = 90
/**
 * 룰 B — 마지막 미래 출발일 cutoff (공개 노출).
 * `lastFutureDepartureDate < now + N일` 이면 공개 노출 제외.
 * 예: 마지막 출발 10/26 → N=3 이면 10/23까지 노출, 10/24부터 숨김.
 */
export const RULE_B_CUTOFF_DAYS = 3
/** G3 동시 락 wait cap — 5공급사 동시 검증 충돌 시 기다릴 한계 (ms). */
const SUPPLIER_LOCK_WAIT_CAP_MS = 15_000

// ---------------------------------------------------------------------------
// 내부 helper (admin-execute-departures-rescrape.ts 비공개 helper 미니 카피 — 트랙 ⑤ 본문 보존)
// ---------------------------------------------------------------------------

/** YMD(`YYYY-MM-DD`) ± delta 일. UTC 기준(달력 일자 SSOT). */
export { addDaysUtcYmd, kstTodayYmd }

/** `fromYmd`~`toYmd` 가 덮는 달 목록 `YYYY-MM` (UTC 날짜 문자열 기준). lottetour 월별 fetch 용. */
function eachYmBetweenInclusive(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const sm = lo.slice(0, 7)
  const em = hi.slice(0, 7)
  let y = parseInt(sm.slice(0, 4), 10)
  let mo = parseInt(sm.slice(5, 7), 10)
  const out: string[] = []
  // safety: 12개월 (= 약 1년 = 룰 A 180일(6개월)을 충분히 cover) 상한
  for (let i = 0; i < 12; i++) {
    const ym = `${y.toString().padStart(4, '0')}-${mo.toString().padStart(2, '0')}`
    out.push(ym)
    if (ym >= em) break
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

/** Rule A 마커 집계 입력 — 출발일·성인가만 필요. */
export type RuleADepartureInputLike = {
  departureDate: string | Date
  adultPrice?: number | null
}

export type RuleAMarkerResult = {
  noFutureDepartureConfirmedAt: Date | null
  lastFutureDepartureDate: Date | null
  marked: boolean
}

/**
 * Rule A 마커 — `runOneSalesPolicyCheck`·modetour sweep 공용 SSOT.
 * `inputs`는 이미 룰 A 윈도우 fetch 결과라고 가정; **미래(오늘 포함) + 성인가 > 0** 만 집계.
 */
export function computeRuleAMarkersFromDepartureInputs(
  inputs: RuleADepartureInputLike[],
  todayYmd: string
): RuleAMarkerResult {
  const futurePricedRows = inputs.filter((x) => {
    const dk = departureInputToYmd(x.departureDate)
    if (dk == null || dk < todayYmd) return false
    const p = x.adultPrice
    return p != null && Number.isFinite(p) && p > 0
  })

  let lastFutureDate: Date | null = null
  if (futurePricedRows.length > 0) {
    let maxYmd = ''
    for (const r of futurePricedRows) {
      const dk = departureInputToYmd(r.departureDate)
      if (dk && dk > maxYmd) maxYmd = dk
    }
    if (maxYmd) lastFutureDate = new Date(`${maxYmd}T00:00:00.000Z`)
  }
  const marked = !hasPricedFutureDepartureInput(inputs, todayYmd)

  return {
    noFutureDepartureConfirmedAt: marked ? new Date() : null,
    lastFutureDepartureDate: lastFutureDate,
    marked,
  }
}

/** 미래 출발일 중 최저 성인가 — sweep `priceFrom` 갱신용. */
export function computePriceFromFromDepartureInputs(
  inputs: RuleADepartureInputLike[],
  todayYmd: string
): number | null {
  let min: number | null = null
  for (const x of inputs) {
    const dk = departureInputToYmd(x.departureDate)
    if (dk == null || dk < todayYmd) continue
    const p = x.adultPrice
    if (p == null || !Number.isFinite(p) || p <= 0) continue
    if (min == null || p < min) min = p
  }
  return min
}

// ---------------------------------------------------------------------------
// pickNextProductToCheck — 1상품 선정 (5분 cron 1tick = 1상품)
// ---------------------------------------------------------------------------

/** `runOneSalesPolicyCheck` 가 필요로 하는 최소 필드. cron tick 마다 1행 fetch. */
export type SalesPolicyCandidate = {
  id: string
  originSource: string | null
  originCode: string | null
  originUrl: string | null
  travelScope: string | null
  brand: { brandKey: string } | null
}

/**
 * 다음 검증 대상 상품 1건. NULL 우선 + `lastSalesPolicyCheckedAt` ASC + `id` ASC tie-break.
 *
 * - 어드민 미등록 / 비공개 / eSIM 등은 `where` 단계에서 제외 (1.10 정책).
 * - 5공급사 외 상품은 후속 `runOneSalesPolicyCheck` 에서 runtime skip + `checkedAt` 만 갱신
 *   (대상 회전에서 빠지지 않도록).
 */
export async function pickNextProductToCheck(
  prisma: PrismaClient
): Promise<SalesPolicyCandidate | null> {
  const row = await prisma.product.findFirst({
    where: {
      registrationStatus: 'registered',
      travelScope: { in: ['overseas', 'domestic'] },
      originSource: { not: 'modetour' },
    },
    orderBy: [
      { lastSalesPolicyCheckedAt: { sort: 'asc', nulls: 'first' } },
      { id: 'asc' },
    ],
    select: {
      id: true,
      originSource: true,
      originCode: true,
      originUrl: true,
      travelScope: true,
      brand: { select: { brandKey: true } },
    },
  })
  return row
}

// ---------------------------------------------------------------------------
// runOneSalesPolicyCheck — 1상품 라이브 검증 + 마커 갱신
// ---------------------------------------------------------------------------

export type SalesPolicyCheckResult = {
  /** `true` 면 라이브 fetch 시도가 끝났음 (skip 포함). `false` 는 발생하지 않음 — 항상 checkedAt 은 갱신. */
  checked: boolean
  /** 룰 A 마커가 부착된 상태인지. `true` = 향후 룰 A 윈도우 내 미래 출발일 0건. */
  marked: boolean
  /** 라이브 fetch 결과 중 미래 출발일의 MAX. 0건이면 `null`. */
  lastFutureDate: Date | null
  /** 식별된 공급사 키 — 5공급사 외/식별 실패 시 `null`(skip 케이스). */
  supplierKey: string | null
  /** 동시 락 미획득(15s 초과) 등 skip 사유. `lastFutureDepartureDate` / `noFutureDepartureConfirmedAt` 는 갱신 안 함. */
  skipReason: 'lock_timeout' | 'unsupported_supplier' | 'lottetour_missing_hints' | null
}

/**
 * 1 상품에 대해 라이브 fetch (룰 A 윈도우 1회) 수행 + Product 마커 3종 갱신.
 *
 * skip 케이스 (라이브 fetch 안 함, `lastSalesPolicyCheckedAt` 만 갱신):
 *  - 5공급사 외 (kyowontour, 알 수 없음 등)
 *  - 같은 공급사 동시 락 미획득 (15s 초과)
 *  - lottetour: rawMeta `godId`/`menuNos` 누락
 */
export async function runOneSalesPolicyCheck(
  prisma: PrismaClient,
  product: SalesPolicyCandidate
): Promise<SalesPolicyCheckResult> {
  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  // supplierKey 식별 — admin-execute-departures-rescrape.ts:464-478 패턴 정합.
  const bk = normalizeBrandKeyToCanonicalSupplierKey(product.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(product.originSource ?? '')
  const supplierKey: string | null =
    bk === 'lottetour' || norm === 'lottetour'
      ? 'lottetour'
      : bk === 'hanatour' || norm === 'hanatour'
        ? 'hanatour'
        : bk === 'verygoodtour' || norm === 'verygoodtour'
            ? 'verygoodtour'
            : norm === 'ybtour' ||
                bk === 'ybtour' ||
                brandKeyResolvesToYbtour(product.brand?.brandKey ?? null)
              ? 'ybtour'
              : null

  // 5공급사 외 — 라이브 fetch 우회. checkedAt 만 갱신해 다음 사이클에서 다른 상품에 자리 양보.
  if (!supplierKey) {
    await prisma.product.update({
      where: { id: product.id },
      data: { lastSalesPolicyCheckedAt: new Date() },
    })
    return {
      checked: true,
      marked: false,
      lastFutureDate: null,
      supplierKey: null,
      skipReason: 'unsupported_supplier',
    }
  }

  // G2: 같은 공급사 직전 스크래핑(또는 cron 배치) 종료 후 random 5~12s 인터벌.
  await waitForSupplierThrottle(prisma, supplierKey)
  // G3: 같은 공급사 동시 1개 락. 15s 까지 wait, 초과 시 skip (마커 갱신 X, checkedAt 만 갱신).
  const lock = await acquireSupplierLock(supplierKey, SUPPLIER_LOCK_WAIT_CAP_MS)
  if (!lock.acquired) {
    await prisma.product.update({
      where: { id: product.id },
      data: { lastSalesPolicyCheckedAt: new Date() },
    })
    return {
      checked: true,
      marked: false,
      lastFutureDate: null,
      supplierKey,
      skipReason: 'lock_timeout',
    }
  }

  let livesRange: DepartureInput[] = []
  let skipReason: SalesPolicyCheckResult['skipReason'] = null
  const detailUrl =
    (product.originUrl ?? '').trim() ||
    buildDetailUrl(product.originSource ?? '', product.originCode ?? '')

  try {
    // G5 시작 시각 — cron + on-demand 정합 (다음 G2 산정의 SSOT).
    await recordSupplierStart(prisma, supplierKey)
    // G4 — 사람처럼 보이는 1~3s 진입 지연.
    await humanDelayBeforeScrape()

    // 5공급사 분기 — admin-execute-departures-rescrape.ts:501-575 의 라이브 fetch 부분 미니 카피.
    //   본 모듈은 ProductDeparture upsert 를 하지 않으므로 fetch 결과(`livesRange`)만 받는다.
    if (supplierKey === 'lottetour') {
      const metaRow = await prisma.product.findUnique({
        where: { id: product.id },
        select: { rawMeta: true, originUrl: true },
      })
      let hints = parseLottetourEvtListCollectionHints({
        rawMeta: metaRow?.rawMeta ?? null,
        originUrl: (product.originUrl ?? '').trim() || metaRow?.originUrl || null,
      })
      const detailUrlResolved =
        (product.originUrl ?? '').trim() ||
        (hints.menuNos && hints.detailEvtCd
          ? buildLottetourEvtDetailUrl(hints.menuNos, hints.detailEvtCd)
          : detailUrl)
      if (!hints.godId && hints.menuNos) {
        hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, detailUrlResolved)
      }
      if (!hints.godId || !hints.menuNos) {
        skipReason = 'lottetour_missing_hints'
      } else {
        const months = eachYmBetweenInclusive(fromYmd, toYmd)
        const allRows = []
        for (const ym of months) {
          const { rows } = await collectLottetourCalendarRange(
            { godId: hints.godId, menuNos: hints.menuNos },
            {
              monthCount: 1,
              dateFrom: ym,
              logLabel: `sales-policy:${product.id}`,
              e2eTourCodeHint:
                (hints.detailEvtCd ?? '').trim() || (product.originCode ?? '').trim() || null,
            }
          )
          allRows.push(...rows)
        }
        const mapped = mapLottetourCalendarToDepartureInputs(allRows, product.id)
        const lo = fromYmd <= toYmd ? fromYmd : toYmd
        const hi = fromYmd <= toYmd ? toYmd : fromYmd
        const filtered = mapped.filter((x) => {
          const dk = departureInputToYmd(x.departureDate as unknown as string)
          return dk != null && dk >= lo && dk <= hi
        })
        livesRange = filterDepartureInputsOnOrAfterCalendarToday(filtered as unknown as DepartureInput[])
      }
    } else if (supplierKey === 'hanatour') {
      livesRange = await collectHanatourDepartureInputsForDateRange(detailUrl, fromYmd, toYmd)
    } else if (supplierKey === 'verygoodtour') {
      const lo = fromYmd <= toYmd ? fromYmd : toYmd
      const hi = fromYmd <= toYmd ? toYmd : fromYmd
      const statusByDate = new Map<string, { statusRaw: string | null; seatsStatusRaw: string | null }>()
      try {
        const cal = await scrapeLiveCalendar(detailUrl, 'verygoodtour', {
          VERYGOOD_DATE_FROM: lo,
          VERYGOOD_DATE_TO: hi,
        })
        livesRange = filterDepartureInputsOnOrAfterCalendarToday(
          mapScrapedRowsToInputs(cal.rows, statusByDate)
        ).filter((x) => {
          const dk = departureInputToYmd(x.departureDate)
          return dk != null && dk >= lo && dk <= hi
        })
      } catch {
        livesRange = []
      }
    } else if (supplierKey === 'ybtour') {
      livesRange = await collectYbtourDepartureInputsForDateRange(
        detailUrl,
        product.originCode,
        fromYmd,
        toYmd
      )
    }
  } finally {
    // G5 완료 시각 — 라이브 fetch 정상/예외/lottetour skip 모두 동일하게 갱신.
    await recordSupplierFinished(prisma, supplierKey)
    lock.release()
  }

  // lottetour hints 누락 — 라이브 fetch 자체를 못 했으니 마커 갱신 보류 (다음 사이클 재시도). checkedAt 만 갱신.
  if (skipReason === 'lottetour_missing_hints') {
    await prisma.product.update({
      where: { id: product.id },
      data: { lastSalesPolicyCheckedAt: new Date() },
    })
    return {
      checked: true,
      marked: false,
      lastFutureDate: null,
      supplierKey,
      skipReason,
    }
  }

  const liveMarkers = computeRuleAMarkersFromDepartureInputs(livesRange, todayYmd)
  const markers = await reconcileRuleAMarkersWithDbFutureDepartures(
    prisma,
    product.id,
    todayYmd,
    liveMarkers,
  )

  await prisma.product.update({
    where: { id: product.id },
    data: {
      noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
      lastFutureDepartureDate: markers.lastFutureDepartureDate,
      lastSalesPolicyCheckedAt: new Date(),
    },
  })

  return {
    checked: true,
    marked: markers.marked,
    lastFutureDate: markers.lastFutureDepartureDate,
    supplierKey,
    skipReason: null,
  }
}

// ---------------------------------------------------------------------------
// 노출 필터 — 8경로 (browse / featured / sitemap / sitemap-images / gallery /
//   product detail × 2 / home-hub) 에서 공통으로 재사용.
//   2-E 에서 prisma where 에 합쳐 쓴다. 어드민 list 는 정책 적용 X.
// ---------------------------------------------------------------------------

/**
 * 룰 B 노출 cutoff — 공개 목록/상세에서 제외할지.
 *
 * - `lastFutureDepartureDate` 있음 → `last < now + RULE_B_CUTOFF_DAYS` 이면 숨김
 *   (10/26 마지막 출발·cutoff 3일: 10/23까지 표시, 10/24부터 숨김).
 * - `lastFutureDepartureDate` 없음 + 룰 A 마커 있음 → 미래 출발 0건 확정 → 숨김.
 * - 둘 다 없음(미평가) → 숨기지 않음.
 */
export function isProductHiddenByPolicy(
  product: {
    noFutureDepartureConfirmedAt: Date | null
    lastFutureDepartureDate: Date | null
  },
  now: Date = new Date()
): boolean {
  if (product.lastFutureDepartureDate != null) {
    const cutoff = now.getTime() + RULE_B_CUTOFF_DAYS * 24 * 60 * 60 * 1000
    return product.lastFutureDepartureDate.getTime() < cutoff
  }
  return product.noFutureDepartureConfirmedAt != null
}

/**
 * 8 노출 경로의 prisma `where` 에 AND 로 합쳐 쓰는 부분 (룰 B cutoff).
 *
 * 의미:
 *  - 마지막 미래 출발일 ≥ NOW() + 3d → 노출
 *  - 아직 미평가(last·마커 둘 다 null) → 노출
 *  - 그 외(마지막 출발이 cutoff 미만, 또는 마커+last null) → 제외
 *
 * 어드민 list 는 이 조건을 합치지 않음. DB 삭제가 아니라 쿼리 제외만.
 */
export function publicProductWhereClause(now: Date = new Date()): Prisma.ProductWhereInput {
  const cutoff = new Date(now.getTime() + RULE_B_CUTOFF_DAYS * 24 * 60 * 60 * 1000)
  return {
    OR: [
      { lastFutureDepartureDate: { gte: cutoff } },
      {
        AND: [{ lastFutureDepartureDate: null }, { noFutureDepartureConfirmedAt: null }],
      },
    ],
  }
}
