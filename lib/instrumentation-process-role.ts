/**
 * Next.js instrumentation cron 등록 역할 SSOT.
 *
 * - `web` (production 기본): HTTP 전용 — 발급(USIMSA) drain 은 기본 안 함.
 * - `worker`: 배치·스크래퍼 + (기본) eSIM OrderPaid/알림톡 발급 드레인.
 * - `fulfill`: 발급 전용 서비스 — OrderPaid + EsimQrNotify 만 (배치 cron 없음).
 * - `all`: 레거시 — web+worker 동시 (`BONGTOUR_INSTRUMENTATION_ROLE=all` 로만).
 *
 * 발급 소유자: `BONGSIM_FULFILL_OWNER=web|worker|fulfill`
 * - unset + role=web → web이 발급 cron (단독 배포 호환)
 * - unset + role=worker|fulfill → 그 프로세스가 발급
 * - web에 `BONGSIM_FULFILL_OWNER=worker`(또는 fulfill) 설정 시 web은 발급 cron/kick drain 안 함
 *
 * Railway: 공개 = web, 복제 = worker 또는 fulfill(도메인 없음).
 * REGRESSION-FREEZE[bongsim-fulfill-owner-split]: fulfill owner + roles — manifest
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
 * 누가 OrderPaid / EsimQrNotify 를 드레인할지.
 * web 단독이면 `web`. worker/fulfill 분리 시 Railway web Variables에
 * `BONGSIM_FULFILL_OWNER=worker` (또는 fulfill) 를 반드시 둔다.
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

/** OrderPaid + EsimQrNotify cron / in-process drain 소유 */
export function shouldRunFulfillmentCrons(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  if (process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === '1') {
    return false
  }
  if (role === 'all') return true
  const owner = resolveBongsimFulfillmentOwner(role)
  if (role === 'web') return owner === 'web'
  if (role === 'worker') return owner === 'worker'
  if (role === 'fulfill') return owner === 'fulfill'
  return false
}

/** 이 프로세스에서 kick → USIMSA drain 을 돌려도 되는지 (소유자만) */
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
  if (
    process.env.NODE_ENV === 'production' &&
    role === 'web' &&
    fulfillOwner === 'web'
  ) {
    console.warn(
      '[instrumentation-role] web이 eSIM 발급 drain을 소유 중 — worker/fulfill 추가 후 BONGSIM_FULFILL_OWNER=worker 권장',
      payload,
    )
  }
  console.log('[instrumentation-role] resolved', payload)
}

export { WEB_CRITICAL_CRON_LOG, BACKGROUND_CRON_LOG, FULFILLMENT_CRON_LOG }
