/**
 * Python calendar_price_scheduler spawn — BONGTOUR_API_BASE·Bearer SSOT.
 */
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { getSchedulerEnvOverrides } from '@/lib/scheduler-config'

/** Python·내부 배치가 호출할 Next 앱 URL (끝 슬래시 없음) */
export function resolveBongtourApiBase(): string {
  const raw =
    process.env.BONGTOUR_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ''
  return raw.replace(/\/$/, '')
}

export function isCalendarCronDisabled(): boolean {
  return process.env.DISABLE_INSTRUMENTATION_CALENDAR_CRON === '1'
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
    pythonExecutable: (process.env.PYTHON ?? process.env.PYTHON_EXECUTABLE ?? '').trim() || (process.platform === 'win32' ? 'python' : 'python3'),
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
  return env
}
