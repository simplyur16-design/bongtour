/**
 * Next.js instrumentation cron 등록 역할 SSOT.
 *
 * - `web` (production 기본): HTTP + eSIM 발급·SMS drain. 워커 포화와 무관하게 문자가 나간다.
 * - `worker`: 가격 sweep·달력 등 배치만. OrderPaid/SMS drain 안 함.
 * - `fulfill`: 발급 전용 서비스 — OrderPaid + EsimQrNotify 만 (배치 cron 없음).
 * - `all`: 레거시 — web+worker 동시 (`BONGTOUR_INSTRUMENTATION_ROLE=all` 로만).
 *
 * `BONGSIM_FULFILL_OWNER=worker` 로 web drain을 끄지 않는다. 문자는 web.
 * 전용 fulfill 서비스만 owner=fulfill 일 때 그 프로세스가 추가 drain.
 *
 * Railway: 공개 = web, 복제 = worker (도메인 없음).
 * REGRESSION-FREEZE[bongsim-fulfill-owner-split]: fulfill owner + roles — manifest
 * REGRESSION-FREEZE[bongsim-sms-drain-on-web]: SMS·발급는 web — manifest
 */
export type InstrumentationProcessRole = 'web' | 'worker' | 'fulfill' | 'all'

export type BongsimFulfillmentOwner = 'web' | 'worker' | 'fulfill'

const WEB_CRITICAL_CRON_LOG = '[instrumentation-role] web-critical cron'
const BACKGROUND_CRON_LOG = '[instrumentation-role] background cron'
const FULFILLMENT_CRON_LOG = '[instrumentation-role] fulfillment cron'

export function resolveInstrumentationProcessRole(): InstrumentationProcessRole {
  const explicit = process.env.BONGTOUR_INSTRUMENTATION_ROLE?.trim().toLowerCase()
  if (explicit === 'worker' || explicit === 'cron') return 'worker'
  if (explicit === 'fulfill' || explicit === 'esim-fulfill' || explicit === 'fulfillment') {
    return 'fulfill'
  }
  if (explicit === 'web' || explicit === 'http') return 'web'
  if (explicit === 'all' || explicit === 'legacy' || explicit === 'combined') return 'all'

  const serviceName = (process.env.RAILWAY_SERVICE_NAME ?? '').trim().toLowerCase()
  if (serviceName.includes('fulfill')) return 'fulfill'
  if (serviceName.includes('worker') || serviceName.includes('cron')) return 'worker'

  if (process.env.NODE_ENV === 'production') return 'web'
  return 'web'
}

/**
 * 레거시 env. SMS는 web이 항상 drain 하므로 worker 값은 web을 끄지 않는다.
 */
export function resolveBongsimFulfillmentOwner(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): BongsimFulfillmentOwner {
  const raw = process.env.BONGSIM_FULFILL_OWNER?.trim().toLowerCase()
  if (raw === 'worker' || raw === 'fulfill' || raw === 'web') return raw
  if (role === 'worker') return 'worker'
  if (role === 'fulfill') return 'fulfill'
  return 'web'
}

export function shouldRunWebCriticalCrons(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  return role === 'web' || role === 'all'
}

export function shouldRunBackgroundCrons(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  return role === 'worker' || role === 'all'
}

/**
 * OrderPaid + EsimQrNotify cron / in-process drain.
 * web은 항상 (문자·발급이 워커 배치와 분리). worker는 안 함.
 * REGRESSION-FREEZE[bongsim-sms-drain-on-web]: web always / worker never — manifest
 */
export function shouldRunFulfillmentCrons(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  if (process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === '1') {
    return false
  }
  if (role === 'all' || role === 'web') return true
  if (role === 'worker') return false
  if (role === 'fulfill') return resolveBongsimFulfillmentOwner(role) === 'fulfill'
  return false
}

/** 이 프로세스에서 kick → USIMSA·SMS drain */
export function shouldDrainOrderPaidInThisProcess(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  return shouldRunFulfillmentCrons(role)
}

let roleLogged = false

export function logInstrumentationProcessRole(): void {
  if (roleLogged) return
  roleLogged = true
  const role = resolveInstrumentationProcessRole()
  const fulfillOwner = resolveBongsimFulfillmentOwner(role)
  const payload = {
    role,
    webCritical: shouldRunWebCriticalCrons(role),
    background: shouldRunBackgroundCrons(role),
    fulfillment: shouldRunFulfillmentCrons(role),
    fulfillOwner,
    railwayService: process.env.RAILWAY_SERVICE_NAME ?? null,
  }
  if (process.env.NODE_ENV === 'production' && role === 'all') {
    console.warn(
      '[instrumentation-role] BONGTOUR_INSTRUMENTATION_ROLE=all in production — web·cron이 한 프로세스에 공존합니다. web+worker 분리를 권장합니다.',
      payload,
    )
    return
  }
  if (process.env.NODE_ENV === 'production' && role === 'web') {
    console.log('[instrumentation-role] eSIM SMS drain on web (independent of worker)', payload)
  }
  console.log('[instrumentation-role] resolved', payload)
}

export { WEB_CRITICAL_CRON_LOG, BACKGROUND_CRON_LOG, FULFILLMENT_CRON_LOG }
