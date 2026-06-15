/**
 * Python calendar_price_scheduler spawn — BONGTOUR_API_BASE·Bearer SSOT.
 */
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'
import { getSchedulerEnvOverrides } from '@/lib/scheduler-config'

/** env 값에서 따옴표·인라인 주석·앞뒤 공백 제거 */
export function sanitizeEnvUrlValue(raw: string): string {
  let v = raw.trim()
  const hash = v.indexOf('#')
  if (hash >= 0) v = v.slice(0, hash).trim()
  if ((v.startsWith('"') && v.includes('"', 1)) || (v.startsWith("'") && v.includes("'", 1))) {
    const q = v[0]!
    const end = v.indexOf(q, 1)
    if (end > 1) v = v.slice(1, end)
  }
  v = v.replace(/^['"]+|['"]+$/g, '').trim()
  return v.replace(/\/$/, '')
}

/** Python·내부 배치가 호출할 Next 앱 URL (끝 슬래시 없음) */
export function resolveBongtourApiBase(): string {
  const raw =
    process.env.BONGTOUR_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ''
  return sanitizeEnvUrlValue(raw)
}

export function isCalendarCronDisabled(): boolean {
  return process.env.DISABLE_INSTRUMENTATION_CALENDAR_CRON === '1'
}

/** web 단독 배포 시 worker 없이 calendar 3h cron — worker 추가 후 web에 설정해 중복 방지 */
export function isWebCalendarCronDisabled(): boolean {
  return process.env.DISABLE_WEB_CALENDAR_CRON === '1'
}

export function hasCalendarBatchCredentials(): boolean {
  return Boolean(getAdminServiceBearerSecret().trim())
}

/** instrumentation 캘린더 크론(21:00 KST) 등록 가능 여부 */
export function canRegisterCalendarCron(): boolean {
  if (isCalendarCronDisabled()) return false
  if (!(process.env.DATABASE_URL ?? '').trim()) return false
  if (!hasCalendarBatchCredentials()) return false
  const inProduction = process.env.NODE_ENV === 'production'
  const devOptIn = process.env.ENABLE_INSTRUMENTATION_CALENDAR_CRON === '1'
  if (!inProduction && !devOptIn) return false
  if (inProduction && !resolveBongtourApiBase()) return false
  return true
}

export type CalendarBatchReadiness = {
  cronCanRegister: boolean
  bearerConfigured: boolean
  apiBase: string
  apiBaseConfigured: boolean
  pythonExecutable: string
  disabledByFlag: boolean
  devOptIn: boolean
  nodeEnv: string
}

export function getCalendarBatchReadiness(): CalendarBatchReadiness {
  const apiBase = resolveBongtourApiBase()
  return {
    cronCanRegister: canRegisterCalendarCron(),
    bearerConfigured: hasCalendarBatchCredentials(),
    apiBase,
    apiBaseConfigured: Boolean(apiBase),
    pythonExecutable: resolvePythonExecutable(),
    disabledByFlag: isCalendarCronDisabled(),
    devOptIn: process.env.ENABLE_INSTRUMENTATION_CALENDAR_CRON === '1',
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  }
}

/** run-once·instrumentation cron 공통 spawn env */
export function getCalendarBatchSpawnEnv(overrides?: Record<string, string>): NodeJS.ProcessEnv {
  const cwd = process.cwd()
  const base = resolveBongtourApiBase()
  const bearer = getAdminServiceBearerSecret()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONPATH: cwd,
    ...getSchedulerEnvOverrides(),
    ...overrides,
  }
  if (base) {
    env.BONGTOUR_API_BASE = base
  }
  if (bearer && !(env.ADMIN_BYPASS_SECRET ?? '').trim()) {
    env.ADMIN_BYPASS_SECRET = bearer
  }
  if (!(env.CALENDAR_BATCH_DB_COOLDOWN_SEC ?? '').trim()) {
    env.CALENDAR_BATCH_DB_COOLDOWN_SEC = process.env.CALENDAR_BATCH_DB_COOLDOWN_SEC ?? '8'
  }
  return env
}
