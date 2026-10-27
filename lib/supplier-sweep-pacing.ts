/**
 * 공급사 일일 sweep(cron) 수집 페이싱 + 차단 감지 시 일시정지·운영 알림.
 *
 * REGRESSION-FREEZE[supplier-sweep-pacing]
 *  - 상품 간 random 딜레이(기본 1.5~3.5s, env `SUPPLIER_SWEEP_DELAY_MIN_MS`/`SUPPLIER_SWEEP_DELAY_MAX_MS`).
 *  - 공급사 거절(403/429/503·captcha·access denied 등) 연속 N회(기본 2, env `SUPPLIER_SWEEP_REFUSAL_THRESHOLD`)
 *    → 해당 공급사 남은 루프 중단 + 프로세스 메모리 일시정지(기본 6h, env `SUPPLIER_SWEEP_PAUSE_MS`)
 *    → `sendAdminOperationalLms` 1회 알림 (`MASTER_INTEGRITY_ALERT_DRY_RUN` 준수).
 *  - DB 스키마 변경 없음: 일시정지 상태는 단일 인스턴스(현 Railway) 프로세스 메모리. 재시작 시 해제.
 *  - 신규 등록 상품도 동일 sweep 루프를 타므로 자동 적용.
 */

export type SupplierSweepPacerOptions = {
  minDelayMs?: number
  maxDelayMs?: number
  refusalThreshold?: number
  pauseMs?: number
  sleep?: (ms: number) => Promise<void>
  alert?: (text: string) => Promise<unknown>
  now?: () => number
  random?: () => number
}

export type SupplierSweepPacer = {
  readonly supplierKey: string
  /** 다음 상품 진행 여부. false 면 호출자는 루프를 break. 두 번째 상품부터 딜레이. */
  beforeProduct(): Promise<boolean>
  /** 상품 처리 중 예외 — 거절 신호면 연속 카운트, 임계 도달 시 일시정지 + 알림. */
  onError(err: unknown): Promise<void>
  isPaused(): boolean
  pauseReason(): string | null
}

const REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:status|http|code)\s*[:=]?\s*(?:403|429|503)\b/i,
  /\b(?:403|429|503)\b\s*(?:forbidden|too many|service unavailable)/i,
  /\btoo many requests\b/i,
  /\bforbidden\b/i,
  /\baccess denied\b/i,
  /\brate[ -]?limit/i,
  /\bcaptcha\b/i,
  /\bcloudflare\b/i,
  /\bblocked\b/i,
  /\bbot detect/i,
  /비정상적인 접근|접근이 차단|접근 제한|요청이 너무 많/,
]

/** 예외/응답 메시지가 공급사 측 거절(차단·레이트리밋)로 보이는지. 네트워크 타임아웃·파싱 오류는 false. */
export function isSupplierRefusalError(err: unknown): boolean {
  if (err == null) return false
  const anyErr = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
  const status = Number(anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status)
  if (status === 403 || status === 429 || status === 503) return true
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return REFUSAL_PATTERNS.some((re) => re.test(msg))
}

const pausedUntilBySupplier = new Map<string, { until: number; reason: string }>()

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function defaultAlert(text: string): Promise<unknown> {
  const { sendAdminOperationalLms } = await import('@/lib/notification-service')
  return sendAdminOperationalLms(text)
}

/** 테스트·운영 수동 해제용. */
export function clearSupplierSweepPause(supplierKey?: string): void {
  if (supplierKey) pausedUntilBySupplier.delete(supplierKey)
  else pausedUntilBySupplier.clear()
}

export function getSupplierSweepPause(
  supplierKey: string,
  now: number = Date.now(),
): { until: number; reason: string } | null {
  const p = pausedUntilBySupplier.get(supplierKey)
  if (!p) return null
  if (p.until <= now) {
    pausedUntilBySupplier.delete(supplierKey)
    return null
  }
  return p
}

export function createSupplierSweepPacer(
  supplierKey: string,
  opts: SupplierSweepPacerOptions = {},
): SupplierSweepPacer {
  const inTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test'
  const minDelay = opts.minDelayMs ?? (inTest ? 0 : envInt('SUPPLIER_SWEEP_DELAY_MIN_MS', 1500))
  const maxDelay = Math.max(minDelay, opts.maxDelayMs ?? (inTest ? 0 : envInt('SUPPLIER_SWEEP_DELAY_MAX_MS', 3500)))
  const threshold = Math.max(1, opts.refusalThreshold ?? envInt('SUPPLIER_SWEEP_REFUSAL_THRESHOLD', 2))
  const pauseMs = opts.pauseMs ?? envInt('SUPPLIER_SWEEP_PAUSE_MS', 6 * 60 * 60 * 1000)
  const sleep = opts.sleep ?? defaultSleep
  const alert = opts.alert ?? (inTest ? async () => undefined : defaultAlert)
  const now = opts.now ?? Date.now
  const random = opts.random ?? Math.random

  let started = 0
  let consecutiveRefusals = 0
  let erroredSinceLast = false
  let localPauseReason: string | null = null

  return {
    supplierKey,
    async beforeProduct() {
      if (localPauseReason) return false
      const existing = getSupplierSweepPause(supplierKey, now())
      if (existing) {
        localPauseReason = existing.reason
        console.warn('[supplier-sweep-pacing] paused-skip', { supplierKey, until: new Date(existing.until).toISOString() })
        return false
      }
      if (!erroredSinceLast) consecutiveRefusals = 0
      erroredSinceLast = false
      if (started > 0 && maxDelay > 0) {
        await sleep(Math.floor(minDelay + random() * (maxDelay - minDelay + 1)))
      }
      started += 1
      return true
    },
    async onError(err) {
      erroredSinceLast = true
      if (!isSupplierRefusalError(err)) {
        consecutiveRefusals = 0
        return
      }
      consecutiveRefusals += 1
      if (consecutiveRefusals < threshold || localPauseReason) return
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 160)
      localPauseReason = `refusal x${consecutiveRefusals}: ${msg}`
      const until = now() + pauseMs
      pausedUntilBySupplier.set(supplierKey, { until, reason: localPauseReason })
      console.error('[supplier-sweep-pacing] pause', { supplierKey, consecutiveRefusals, until: new Date(until).toISOString() })
      try {
        await alert(
          `[수집 일시정지] ${supplierKey} 공급사 거절 ${consecutiveRefusals}회 연속 — sweep 중단, ${Math.round(pauseMs / 60000)}분 후 재개. 사유: ${msg}`,
        )
      } catch (e) {
        console.error('[supplier-sweep-pacing] alert-failed', { supplierKey, message: String(e).slice(0, 200) })
      }
    },
    isPaused: () => localPauseReason != null,
    pauseReason: () => localPauseReason,
  }
}
