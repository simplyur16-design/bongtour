/**
 * Next.js instrumentation cron 등록 역할 SSOT.
 *
 * - `web` (production 기본): HTTP 전용 — 결제 outbox만 in-process (가벼운 DB 드레인).
 * - `worker`: 배치·스크래퍼·Gemini·cache-warm 등 무거운 cron 전부.
 * - `all`: 레거시 — web+worker 동시 (`BONGTOUR_INSTRUMENTATION_ROLE=all` 로만).
 *
 * Railway: 공개 트래픽 서비스 = web, 동일 repo 복제 서비스(도메인 없음) = worker.
 */
export type InstrumentationProcessRole = 'web' | 'worker' | 'all'

const WEB_CRITICAL_CRON_LOG = '[instrumentation-role] web-critical cron'
const BACKGROUND_CRON_LOG = '[instrumentation-role] background cron'

export function resolveInstrumentationProcessRole(): InstrumentationProcessRole {
  const explicit = process.env.BONGTOUR_INSTRUMENTATION_ROLE?.trim().toLowerCase()
  if (explicit === 'worker' || explicit === 'cron') return 'worker'
  if (explicit === 'web' || explicit === 'http') return 'web'
  if (explicit === 'all' || explicit === 'legacy' || explicit === 'combined') return 'all'

  const serviceName = (process.env.RAILWAY_SERVICE_NAME ?? '').trim().toLowerCase()
  if (serviceName.includes('worker') || serviceName.includes('cron')) return 'worker'

  if (process.env.NODE_ENV === 'production') return 'web'
  return 'web'
}

export function shouldRunWebCriticalCrons(role: InstrumentationProcessRole = resolveInstrumentationProcessRole()): boolean {
  return role === 'web' || role === 'all'
}

export function shouldRunBackgroundCrons(role: InstrumentationProcessRole = resolveInstrumentationProcessRole()): boolean {
  return role === 'worker' || role === 'all'
}

let roleLogged = false

export function logInstrumentationProcessRole(): void {
  if (roleLogged) return
  roleLogged = true
  const role = resolveInstrumentationProcessRole()
  const payload = {
    role,
    webCritical: shouldRunWebCriticalCrons(role),
    background: shouldRunBackgroundCrons(role),
    railwayService: process.env.RAILWAY_SERVICE_NAME ?? null,
  }
  if (process.env.NODE_ENV === 'production' && role === 'all') {
    console.warn(
      '[instrumentation-role] BONGTOUR_INSTRUMENTATION_ROLE=all in production — web·cron이 한 프로세스에 공존합니다. web+worker 분리를 권장합니다.',
      payload,
    )
    return
  }
  console.log('[instrumentation-role] resolved', payload)
}

export { WEB_CRITICAL_CRON_LOG, BACKGROUND_CRON_LOG }
