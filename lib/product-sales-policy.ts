/**
 * 트랙 ⑥ 상품 노출·판매 정책 — 5분 cron 라이브 검증 모듈.
 *
 * 호출자:
 *  - `lib/instrumentation-product-sales-policy-cron.ts` (5분 인터벌, 상품 1개 처리) — 2-C
 *  - 8 노출 경로 (browse / featured / sitemap / sitemap-images / gallery / product detail × 2 / home-hub) — 2-E
 *
 * 정책 SSOT:
 *  - 룰 A — 향후 90일 이내 미래 출발일 0건 확인 시 `Product.noFutureDepartureConfirmedAt = NOW()` 기록.
 *           1건이라도 발견 시 NULL 로 초기화. `registrationStatus` 자동 변경 X (어드민 SSOT 유지).
 *  - 룰 B — 마커 부착 AND `lastFutureDepartureDate < NOW() + 7d` 면 사용자 노출 제외.
 *
 * 봇 차단 회피 — 트랙 ⑤ B' 가드(`waitForSupplierThrottle`/`acquireSupplierLock`/
 *   `humanDelayBeforeScrape`/`recordSupplierStart`/`recordSupplierFinished`)를 import 재사용.
 *   `executeRangeOnDemandDepartures`(`windowDays` cap 31) 는 우회 — 1.7 결정에 따라 5공급사 분기 함수를
 *   본 모듈에서 직접 호출(라이브 fetch 90일 1회).
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
import { collectModetourDepartureInputsForDateRange } from '@/lib/modetour-departures'
import {
  collectLottetourCalendarRange,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import {
  brandKeyResolvesToYbtour,
  normalizeBrandKeyToCanonicalSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { departureInputToYmd, filterDepartureInputsOnOrAfterCalendarToday } from '@/lib/scrape-date-bounds'
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

/** 룰 A — 미래 출발일 탐색 범위 (today ~ today + N일). */
const RULE_A_WINDOW_DAYS = 90
/** 룰 B — 마지막 미래 출발일 cutoff (today + N일 미만이면 노출 제외). */
const RULE_B_CUTOFF_DAYS = 7
/** G3 동시 락 wait cap — 5공급사 동시 검증 충돌 시 기다릴 한계 (ms). */
const SUPPLIER_LOCK_WAIT_CAP_MS = 15_000

// ---------------------------------------------------------------------------
// 내부 helper (admin-execute-departures-rescrape.ts 비공개 helper 미니 카피 — 트랙 ⑤ 본문 보존)
// ---------------------------------------------------------------------------

/** YMD(`YYYY-MM-DD`) ± delta 일. UTC 기준(달력 일자 SSOT). */
function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** `fromYmd`~`toYmd` 가 덮는 달 목록 `YYYY-MM` (UTC 날짜 문자열 기준). lottetour 월별 fetch 용. */
function eachYmBetweenInclusive(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const sm = lo.slice(0, 7)
  const em = hi.slice(0, 7)
  let y = parseInt(sm.slice(0, 4), 10)
  let mo = parseInt(sm.slice(5, 7), 10)
  const out: string[] = []
  // safety: 12개월 (= 약 1년 = 룰 A 90일을 충분히 cover) 상한
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

/** KST 기준 오늘(`YYYY-MM-DD`). 라이브 fetch 의 `fromYmd` 시작점. */
function kstTodayYmd(): string {
  const now = new Date()
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000
  return new Date(kstMs).toISOString().slice(0, 10)
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
  /** 룰 A 마커가 부착된 상태인지. `true` = 향후 90일 미래 출발일 0건. */
  marked: boolean
  /** 라이브 fetch 결과 중 미래 출발일의 MAX. 0건이면 `null`. */
  lastFutureDate: Date | null
  /** 식별된 공급사 키 — 5공급사 외/식별 실패 시 `null`(skip 케이스). */
  supplierKey: string | null
  /** 동시 락 미획득(15s 초과) 등 skip 사유. `lastFutureDepartureDate` / `noFutureDepartureConfirmedAt` 는 갱신 안 함. */
  skipReason: 'lock_timeout' | 'unsupported_supplier' | 'lottetour_missing_hints' | null
}

/**
 * 1 상품에 대해 라이브 fetch (90일 1회) 수행 + Product 마커 3종 갱신.
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
        : bk === 'modetour' || norm === 'modetour'
          ? 'modetour'
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
      const hints = parseLottetourEvtListCollectionHints({
        rawMeta: metaRow?.rawMeta ?? null,
        originUrl: (product.originUrl ?? '').trim() || metaRow?.originUrl || null,
      })
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
    } else if (supplierKey === 'modetour') {
      livesRange = await collectModetourDepartureInputsForDateRange(product.originUrl, fromYmd, toYmd)
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

  // 결과 집계 — 미래 출발일만 (오늘 포함). YMD 비교로 timezone 안전.
  const futureRows = livesRange.filter((x) => {
    const dk = departureInputToYmd(x.departureDate)
    return dk != null && dk >= todayYmd
  })

  let lastFutureDate: Date | null = null
  if (futureRows.length > 0) {
    let maxYmd = ''
    for (const r of futureRows) {
      const dk = departureInputToYmd(r.departureDate)
      if (dk && dk > maxYmd) maxYmd = dk
    }
    if (maxYmd) lastFutureDate = new Date(`${maxYmd}T00:00:00.000Z`)
  }
  const marked = futureRows.length === 0

  await prisma.product.update({
    where: { id: product.id },
    data: {
      noFutureDepartureConfirmedAt: marked ? new Date() : null,
      lastFutureDepartureDate: lastFutureDate,
      lastSalesPolicyCheckedAt: new Date(),
    },
  })

  return {
    checked: true,
    marked,
    lastFutureDate,
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
 * 룰 B 노출 cutoff — 마커 부착 AND `lastFutureDepartureDate < NOW() + 7d` 면 사용자 노출 제외.
 *
 * - `noFutureDepartureConfirmedAt IS NULL` → 정책 미적용 (기존 동작 그대로).
 * - `lastFutureDepartureDate IS NULL` → 룰 A 위반 (미래 출발일 0건) → 노출 제외.
 * - `lastFutureDepartureDate < NOW() + 7d` → 룰 B 위반 → 노출 제외.
 */
export function isProductHiddenByPolicy(
  product: {
    noFutureDepartureConfirmedAt: Date | null
    lastFutureDepartureDate: Date | null
  },
  now: Date = new Date()
): boolean {
  if (product.noFutureDepartureConfirmedAt == null) return false
  if (product.lastFutureDepartureDate == null) return true
  const cutoff = now.getTime() + RULE_B_CUTOFF_DAYS * 24 * 60 * 60 * 1000
  return product.lastFutureDepartureDate.getTime() < cutoff
}

/**
 * 8 노출 경로의 prisma `where` 에 AND 로 합쳐 쓰는 부분 (룰 B cutoff).
 *
 * 의미: "마커 미부착 (정책 미적용)" OR "마지막 미래 출발일 ≥ NOW() + 7d".
 *  → 어드민 list 는 이 조건을 합치지 않음(정책 X).
 *
 * 캐시 컬럼(`lastFutureDepartureDate`) 단일 비교로 8경로 공통 적용 — `runOneSalesPolicyCheck` 가 5분마다
 *  1상품씩 갱신해 stale ≤10h. D-7 cutoff 정확도에는 영향 0.
 */
export function publicProductWhereClause(now: Date = new Date()): Prisma.ProductWhereInput {
  const cutoff = new Date(now.getTime() + RULE_B_CUTOFF_DAYS * 24 * 60 * 60 * 1000)
  return {
    OR: [
      { noFutureDepartureConfirmedAt: null },
      { lastFutureDepartureDate: { gte: cutoff } },
    ],
  }
}
