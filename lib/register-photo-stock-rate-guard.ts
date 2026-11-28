/**
 * 사진 검색 호출 속도·멈춤 (사장님 11/01 자동 사진 규칙).
 * - Pexels: 호출 사이 최소 3.5초. 403·429 를 받으면 1시간 동안 더 부르지 않는다(재시도 없음).
 * - Unsplash: 공용 예산 한 시간 900번(사장님 11/28 08:08 한도 1000 미만, 검색 + download_location 모두 셈), 헤더 remaining 0·403·429 면 1시간 멈춤(재시도 없음).
 * - Pixabay: 60초 60번(공식 100), 헤더 0 이면 reset 까지 멈춤.
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
    if (isStockStopStatus(status)) this.stoppedUntil = Math.max(this.stoppedUntil, this.clock.now() + STOCK_STOP_AFTER_LIMIT_MS)
  }
  /**
   * REGRESSION-FREEZE[pexels-quota-1128]: 응답 헤더 x-ratelimit-remaining 이 0 이면 x-ratelimit-reset 까지 Pexels 를 부르지 않는다
   * (월 한도 소진 뒤 매시간 다시 부르던 낭비 차단). 멈춤은 늘리기만 한다 — manifest
   */
  onQuotaHeaders(remaining: number | null, resetEpochSec: number | null): void {
    if (remaining == null || !Number.isFinite(remaining) || remaining > 0) return
    const now = this.clock.now()
    const resetMs = resetEpochSec != null && Number.isFinite(resetEpochSec) && resetEpochSec * 1000 > now ? resetEpochSec * 1000 : now + STOCK_STOP_AFTER_LIMIT_MS
    this.stoppedUntil = Math.max(this.stoppedUntil, Math.min(resetMs, now + PEXELS_QUOTA_STOP_MAX_MS))
  }
  stoppedUntilMs(): number {
    return this.stoppedUntil
  }
}

/** 헤더 reset 이 이상하게 먼 값이어도 이 기간을 넘겨 멈추지 않는다(월 한도 주기 + 여유) */
export const PEXELS_QUOTA_STOP_MAX_MS = 35 * 24 * 60 * 60 * 1000

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
    if (isStockStopStatus(status)) this.stoppedUntil = Math.max(this.stoppedUntil, this.clock.now() + STOCK_STOP_AFTER_LIMIT_MS)
  }
  /**
   * REGRESSION-FREEZE[free-src-1128]: 응답 헤더 X-Ratelimit-Remaining 이 0 이면 1시간(Unsplash 시간 창) 부르지 않는다.
   * 헤더 한도가 우리 예산보다 작으면(데모 키 50) 헤더가 먼저 멈춘다 — manifest
   */
  onQuotaHeaders(remaining: number | null): void {
    if (remaining == null || !Number.isFinite(remaining) || remaining > 0) return
    this.stoppedUntil = Math.max(this.stoppedUntil, this.clock.now() + HOUR_MS)
  }
  stoppedUntilMs(): number {
    return this.stoppedUntil
  }
  /** 다음 호출이 가능해지는 시각(ms). 지금 가능하면 현재 시각. 자가치유가 한도 창이 풀릴 때까지 기다린 뒤 이어서 처리하는 데 쓴다. */
  nextAvailableAtMs(): number {
    const now = this.clock.now()
    if (this.stoppedUntil > now) return this.stoppedUntil
    if (this.remaining() > 0) return now
    const oldest = Math.min(...this.calls)
    return Number.isFinite(oldest) ? oldest + HOUR_MS : now
  }
}

/**
 * 사장님 11/28 08:08 'unsplash는 시간당 1000회 한도' — 운영 키 한도 1000 미만으로 여유를 두고 시간당 900번(검색 + download_location).
 * 클래스 기본값(45)은 예전 데모 키 기준 시험용으로 그대로 두고, 실제 공용 예산만 이 값을 쓴다.
 * REGRESSION-FREEZE[free-src-1128]: 공용 Unsplash 예산 시간당 900(<1000) — manifest
 */
export const UNSPLASH_PROD_MAX_CALLS_PER_HOUR = 900

/**
 * Pixabay 공식 한도 60초 100번(https://pixabay.com/api/docs/) — 여유를 두고 60초 60번.
 * 헤더 X-RateLimit-Remaining 0 이면 X-RateLimit-Reset 초 뒤까지 멈춤. 403·429 는 1시간 멈춤(재시도 없음).
 * REGRESSION-FREEZE[free-src-1128]: Pixabay 60초 60번·헤더 0 이면 reset 까지 — manifest
 */
export const PIXABAY_MAX_CALLS_PER_MINUTE = 60
const MINUTE_MS = 60 * 1000
export class PixabayCallGuard {
  private calls: number[] = []
  private stoppedUntil = 0
  constructor(private readonly clock: StockGuardClock = realStockGuardClock, private readonly maxPerMinute = PIXABAY_MAX_CALLS_PER_MINUTE) {}
  isStopped(): boolean {
    return this.clock.now() < this.stoppedUntil
  }
  remaining(): number {
    const now = this.clock.now()
    this.calls = this.calls.filter((t) => now - t < MINUTE_MS)
    return Math.max(0, this.maxPerMinute - this.calls.length)
  }
  tryAcquire(): boolean {
    if (this.isStopped()) return false
    if (this.remaining() <= 0) return false
    this.calls.push(this.clock.now())
    return true
  }
  onStatus(status: number): void {
    if (isStockStopStatus(status)) this.stoppedUntil = Math.max(this.stoppedUntil, this.clock.now() + STOCK_STOP_AFTER_LIMIT_MS)
  }
  onQuotaHeaders(remaining: number | null, resetSec: number | null): void {
    if (remaining == null || !Number.isFinite(remaining) || remaining > 0) return
    const waitMs = resetSec != null && Number.isFinite(resetSec) && resetSec > 0 ? Math.min(resetSec * 1000, HOUR_MS) : MINUTE_MS
    this.stoppedUntil = Math.max(this.stoppedUntil, this.clock.now() + waitMs)
  }
  /** 다음 호출이 가능해지는 시각(ms). 지금 가능하면 현재 시각. */
  nextAvailableAtMs(): number {
    const now = this.clock.now()
    if (this.stoppedUntil > now) return this.stoppedUntil
    if (this.remaining() > 0) return now
    const oldest = Math.min(...this.calls)
    return Number.isFinite(oldest) ? oldest + MINUTE_MS : now
  }
}

/** 사진 풀 보충(썸네일 top-up)이 쓸 수 있는 Unsplash 시간당 몫 — 나머지는 칸 검색 몫(사장님 11/27 21:31 한도 몫 분리) */
export const UNSPLASH_TOPUP_SHARE_PER_HOUR = 15

const g = globalThis as unknown as { __btPexelsGuard?: PexelsCallGuard; __btUnsplashBudget?: UnsplashCallBudget; __btUnsplashTopUpShare?: UnsplashCallBudget; __btPixabayGuard?: PixabayCallGuard }
export function sharedPexelsCallGuard(): PexelsCallGuard {
  return (g.__btPexelsGuard ??= new PexelsCallGuard())
}
export function sharedUnsplashCallBudget(): UnsplashCallBudget {
  return (g.__btUnsplashBudget ??= new UnsplashCallBudget(realStockGuardClock, UNSPLASH_PROD_MAX_CALLS_PER_HOUR))
}

export function sharedPixabayCallGuard(): PixabayCallGuard {
  return (g.__btPixabayGuard ??= new PixabayCallGuard())
}

/** 풀 보충용 Unsplash 몫(시간당 15). 전체 예산(900)은 실제 호출에서 따로 센다. */
export function sharedUnsplashTopUpShare(): UnsplashCallBudget {
  return (g.__btUnsplashTopUpShare ??= new UnsplashCallBudget(realStockGuardClock, UNSPLASH_TOPUP_SHARE_PER_HOUR))
}

/**
 * 한도에 막혀 못 한 칸을 같은 실행에서 이어 처리하려고 기다릴 시각(ms). Unsplash·Pixabay 한도 창이 풀리는 가장 빠른 시각.
 * 둘 다 지금 호출 가능하면 null(한도 탓이 아니므로 기다릴 이유 없음). Pexels 는 월 한도라 기다리지 않는다.
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 자가치유는 쿼터 창이 풀릴 때까지 같은 실행 안에서 기다린 뒤 이어서 처리 — manifest
 */
export function stockQuotaResumeAtMs(): number | null {
  const now = realStockGuardClock.now()
  const at = [sharedUnsplashCallBudget().nextAvailableAtMs(), sharedPixabayCallGuard().nextAvailableAtMs()].filter((t) => t > now)
  return at.length > 0 ? Math.min(...at) : null
}
