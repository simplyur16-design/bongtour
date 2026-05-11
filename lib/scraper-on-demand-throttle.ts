/**
 * On-demand 라이브 스크래핑 — 봇 차단 회피용 다층 가드 (G1 ~ G5).
 *
 * 호출자: `lib/admin-execute-departures-rescrape.ts` 의 `executeRangeOnDemandDepartures`
 *  (사용자 상세 페이지에서 출발일 클릭 → `/api/products/[id]` POST `range-on-demand`).
 *
 * 가드 종류:
 *  - G1 (per-departure 30분 쿨다운): `checkPerDepartureCooldown` + `recordDepartureAttempt`
 *      → 같은 (productId, departureDate) 의 마지막 시도 < 30분이면 cached 응답.
 *  - G2 (per-supplier 5~12s random throttle): `waitForSupplierThrottle`
 *      → 같은 공급사 직전 스크래핑 종료 시각 + random(5~12s) 까지 sleep.
 *      → cron 배치 종료 시각도 같은 SSOT(`ScraperSupplierState.lastFinishedAt`) 라 정합 (Q2 정책).
 *  - G3 (per-supplier 동시 락 wait cap 15s): `acquireSupplierLock`
 *      → 같은 공급사 동시 라이브 스크래핑 1개. 다음 호출은 15s 까지 wait, 초과 시 cached 응답 (Q1 (c) 하이브리드).
 *      → 단일 인스턴스 가정 (현 Railway). 멀티 인스턴스 전환 시 Postgres advisory lock 등으로 교체.
 *  - G4 (스크래핑 직전 1~3s random sleep): `humanDelayBeforeScrape`
 *      → 사람처럼 보이는 진입 지연. `lib/scraper-throttle.ts` 의 `humanDelay` 재활용.
 *  - G5 (timestamp 기록): `recordSupplierStart` / `recordSupplierFinished`
 *      → cron + on-demand 공통 호출 → G2 인터벌 산정의 SSOT.
 *
 * 본 모듈은 6 공급사 스크래퍼 본문(`collectXxxDepartureInputsForDateRange` / `scrapeLiveCalendar` 등)을 호출하지 않는다.
 * 가드는 호출부(`executeRangeOnDemandDepartures`)에서 라이브 분기 진입 직전에 둘러싸는 형태로 적용한다.
 */

import type { PrismaClient } from '@prisma/client'
import { humanDelay } from '@/lib/scraper-throttle'

/** YMD(`YYYY-MM-DD`) 를 UTC 자정 Date 로 (ProductDeparture.departureDate 매칭용). */
function utcMidnight(ymd: string): Date {
  return new Date(ymd + 'T00:00:00.000Z')
}

// ---------------------------------------------------------------------------
// G1 — per-departure 30분 쿨다운
// ---------------------------------------------------------------------------

/**
 * `(productId, departureDate)` 의 마지막 라이브 스크래핑 시도 시각을 조회해
 *  지금 시각과의 elapsed 가 `cooldownMs` 미만이면 `cooldownActive = true`.
 *
 * - row 가 없거나 `lastScrapeAttemptAt` 이 NULL 이면 `cooldownActive = false` (첫 시도 허용).
 * - 운영 정책 Q4 (a): `cooldownActive = true` 일 때 호출자는 기존 reason `departure_exists_price_unavailable` 응답.
 */
export async function checkPerDepartureCooldown(
  prisma: PrismaClient,
  productId: string,
  departureYmd: string,
  cooldownMs: number = 30 * 60 * 1000
): Promise<{ cooldownActive: boolean; lastAttemptedAt: Date | null }> {
  const row = await prisma.productDeparture.findFirst({
    where: { productId, departureDate: utcMidnight(departureYmd) },
    select: { lastScrapeAttemptAt: true },
  })
  const lastAttemptedAt = row?.lastScrapeAttemptAt ?? null
  if (!lastAttemptedAt) return { cooldownActive: false, lastAttemptedAt: null }
  const elapsed = Date.now() - lastAttemptedAt.getTime()
  return { cooldownActive: elapsed < cooldownMs, lastAttemptedAt }
}

/**
 * 라이브 스크래핑 진입 직전 호출 — `(productId, departureDate)` 의 row 가 이미 있으면
 *  `lastScrapeAttemptAt = now()` 로 갱신.
 *
 * - row 가 없으면 silently no-op (`updateMany`). 이는 신규 일자(`!existing` 분기)인 경우인데,
 *   해당 분기는 라이브 결과가 새 row 를 upsert 하므로 `lastScrapeAttemptAt` 이 굳이 미리 박혀
 *   있지 않아도 무방하다. 후속 upsert(`upsertProductDepartures`) 가 row 를 만들지만
 *   `DepartureInput` 에 `lastScrapeAttemptAt` 필드가 없어 NULL 로 남는다 — 다음 라이브 시도 시
 *   다시 이 함수가 갱신할 기회를 갖는다 (cooldown 첫 사이클 누락 비용 < 신규 컬럼·필드 전파 비용).
 * - 기존 row 케이스(`existing && price_unavailable` fall-through 등) 에는 정확히 cooldown 시작.
 */
export async function recordDepartureAttempt(
  prisma: PrismaClient,
  productId: string,
  departureYmd: string
): Promise<void> {
  await prisma.productDeparture.updateMany({
    where: { productId, departureDate: utcMidnight(departureYmd) },
    data: { lastScrapeAttemptAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// G2 + G5 — per-supplier 인터벌 + 시작/완료 기록
// ---------------------------------------------------------------------------

/**
 * 같은 공급사 직전 스크래핑 종료 시각(`lastFinishedAt`) + random(`intervalMin`~`intervalMax`)ms
 *  까지 sleep. cron 배치도 같은 row 를 갱신 → on-demand 와 cron 인터벌 정합 (Q2 정책).
 *
 * - row 가 없거나 `lastFinishedAt` 이 NULL → 즉시 진행.
 * - elapsed 가 random target 보다 크면 즉시 진행.
 */
export async function waitForSupplierThrottle(
  prisma: PrismaClient,
  supplierKey: string,
  intervalMin: number = 5000,
  intervalMax: number = 12000
): Promise<void> {
  const row = await prisma.scraperSupplierState.findUnique({
    where: { supplierKey },
    select: { lastFinishedAt: true },
  })
  const last = row?.lastFinishedAt ?? null
  if (!last) return
  const elapsed = Date.now() - last.getTime()
  const lo = Math.min(intervalMin, intervalMax)
  const hi = Math.max(intervalMin, intervalMax)
  const target = Math.floor(Math.random() * (hi - lo + 1)) + lo
  const remain = target - elapsed
  if (remain > 0) {
    await new Promise<void>((r) => setTimeout(r, remain))
  }
}

export async function recordSupplierStart(
  prisma: PrismaClient,
  supplierKey: string
): Promise<void> {
  const now = new Date()
  await prisma.scraperSupplierState.upsert({
    where: { supplierKey },
    update: { lastStartedAt: now },
    create: { supplierKey, lastStartedAt: now },
  })
}

export async function recordSupplierFinished(
  prisma: PrismaClient,
  supplierKey: string
): Promise<void> {
  const now = new Date()
  await prisma.scraperSupplierState.upsert({
    where: { supplierKey },
    update: { lastFinishedAt: now },
    create: { supplierKey, lastFinishedAt: now },
  })
}

// ---------------------------------------------------------------------------
// G3 — per-supplier 동시 락 (process-local, wait cap 15s)
// ---------------------------------------------------------------------------

type SupplierLockGate = {
  /** 공급사별 "내가 release 되면 알려준다" 약속의 큐 tail. 후속 acquirer 는 여기에 await. */
  inflight: Map<string, Promise<void>>
}

function lockGate(): SupplierLockGate {
  const g = globalThis as typeof globalThis & { __bongtourSupplierLockGate?: SupplierLockGate }
  if (!g.__bongtourSupplierLockGate) {
    g.__bongtourSupplierLockGate = { inflight: new Map() }
  }
  return g.__bongtourSupplierLockGate
}

/**
 * 같은 공급사 동시 라이브 스크래핑 1개 락 (process-local). `waitCapMs` 까지 wait, 초과 시 `acquired = false`.
 *
 * - 단일 인스턴스(현 Railway) 가정. 멀티 인스턴스로 전환 시 Postgres advisory lock 등으로 교체.
 * - 후속 acquirer 가 큐에 잘 줄 서도록 큐 tail 을 항상 갱신 (timeout 시에도 자기 슬롯 정리).
 * - 호출자는 `release()` 를 try/finally 의 finally 에서 반드시 호출해야 데드락 위험이 없다.
 */
export async function acquireSupplierLock(
  supplierKey: string,
  waitCapMs: number = 15000
): Promise<{ acquired: boolean; release: () => void }> {
  const gate = lockGate()
  const predecessor = gate.inflight.get(supplierKey) ?? null

  let resolveMine!: () => void
  const mine = new Promise<void>((r) => {
    resolveMine = r
  })
  gate.inflight.set(supplierKey, mine)

  const cleanupSelf = () => {
    if (gate.inflight.get(supplierKey) === mine) {
      gate.inflight.delete(supplierKey)
    }
    resolveMine()
  }

  if (!predecessor) {
    return {
      acquired: true,
      release: cleanupSelf,
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutP = new Promise<'timeout'>((r) => {
    timeoutId = setTimeout(() => r('timeout'), waitCapMs)
  })
  const result = await Promise.race([
    predecessor.then(() => 'released' as const),
    timeoutP,
  ])
  if (timeoutId) clearTimeout(timeoutId)

  if (result === 'timeout') {
    cleanupSelf()
    return { acquired: false, release: () => {} }
  }

  return {
    acquired: true,
    release: cleanupSelf,
  }
}

// ---------------------------------------------------------------------------
// G4 — 스크래핑 직전 1~3s random sleep
// ---------------------------------------------------------------------------

/**
 * 사람처럼 보이는 진입 지연 (`lib/scraper-throttle.ts` 의 `humanDelay` 재활용).
 *
 * `acquireSupplierLock` 직후, `recordSupplierStart` 직전·직후 어디든 OK.
 * 호출부는 락 획득 → start 기록 → humanDelay → 라이브 스크래핑 순으로 둔다.
 */
export async function humanDelayBeforeScrape(min: number = 1000, max: number = 3000): Promise<void> {
  await humanDelay(min, max)
}
