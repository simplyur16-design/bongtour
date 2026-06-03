import { requireAdmin } from '@/lib/require-admin'
import { summarizeConsultNotificationEnv } from '@/lib/consult-notification-env'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

/** GET — 문의·예약 접수 알림 env 요약(비밀 미포함) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return jsonWithLeakGuard({ error: 'Unauthorized' }, 'admin.ops.notification-env.auth', { status: 401 })
  }
  return jsonWithLeakGuard(
    { ok: true, env: summarizeConsultNotificationEnv(), nodeEnv: process.env.NODE_ENV ?? 'unknown' },
    'admin.ops.notification-env.ok',
  )
}
