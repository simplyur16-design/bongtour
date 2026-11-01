/**
 * 사진 검색 호출 속도·멈춤 (사장님 11/01 자동 사진 규칙).
 * - Pexels: 호출 사이 최소 3.5초. 403·429 를 받으면 1시간 동안 더 부르지 않는다(재시도 없음).
 * - Unsplash: 한 시간에 45번까지(검색 + download_location 모두 셈). 403·429 를 받으면 1시간 동안 멈춤(재시도 없음).
 * 프로세스(web·worker) 안 메모리 기준 — 키·응답 본문은 기록하지 않는다.
 */
export const PEXELS_MIN_INTERVAL_MS = 3500
export const UNSPLASH_MAX_CALLS_PER_HOUR = 45
export const STOCK_STOP_AFTER_LIMIT_MS = 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export type StockGuardClock = { now: () => number; sleep: (ms: number) => Promise<void> }
export const realStockGuardClock: StockGuardClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

export function isStockStopStatus(status: number): boolean {
  return status === 403 || status === 429
}

export class PexelsCallGuard {
  private nextAt = 0
  private stoppedUntil = 0
  constructor(private readonly clock: StockGuardClock = realStockGuardClock, private readonly minIntervalMs = PEXELS_MIN_INTERVAL_MS) {}
  isStopped(): boolean {
    return this.clock.now() < this.stoppedUntil
  }
  /** 다음 호출 자리를 잡고 간격만큼 기다린다. 멈춤 상태면 false(호출하지 말 것). */
  async acquire(): Promise<boolean> {
    if (this.isStopped()) return false
    const now = this.clock.now()
    const at = Math.max(now, this.nextAt)
    this.nextAt = at + this.minIntervalMs
    if (at > now) await this.clock.sleep(at - now)
    return !this.isStopped()
  }
  onStatus(status: number): void {
    if (isStockStopStatus(status)) this.stoppedUntil = this.clock.now() + STOCK_STOP_AFTER_LIMIT_MS
  }
}

export class UnsplashCallBudget {
  private calls: number[] = []
  private stoppedUntil = 0
  constructor(private readonly clock: StockGuardClock = realStockGuardClock, private readonly maxPerHour = UNSPLASH_MAX_CALLS_PER_HOUR) {}
  isStopped(): boolean {
    return this.clock.now() < this.stoppedUntil
  }
  remaining(): number {
    const now = this.clock.now()
    this.calls = this.calls.filter((t) => now - t < HOUR_MS)
    return Math.max(0, this.maxPerHour - this.calls.length)
  }
  /** 호출 1번을 쓴다. 예산이 없거나 멈춤이면 false(호출하지 말 것). */
  tryAcquire(): boolean {
    if (this.isStopped()) return false
    if (this.remaining() <= 0) return false
    this.calls.push(this.clock.now())
    return true
  }
  onStatus(status: number): void {
    if (isStockStopStatus(status)) this.stoppedUntil = this.clock.now() + STOCK_STOP_AFTER_LIMIT_MS
  }
}

const g = globalThis as unknown as { __btPexelsGuard?: PexelsCallGuard; __btUnsplashBudget?: UnsplashCallBudget }
export function sharedPexelsCallGuard(): PexelsCallGuard {
  return (g.__btPexelsGuard ??= new PexelsCallGuard())
}
export function sharedUnsplashCallBudget(): UnsplashCallBudget {
  return (g.__btUnsplashBudget ??= new UnsplashCallBudget())
}
