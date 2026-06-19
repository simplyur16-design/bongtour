import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { runMetaTokenRefreshTick } from '@/lib/instrumentation-meta-token-refresh-cron'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

/** PR (가)-9 — 외부 cron → Meta long-lived token 갱신 (단일 web, BONGTOUR_CRON_SECRET) */
export async function GET() {
  return jsonWithLeakGuard({ error: 'method_not_allowed' }, 'cron-meta-token-refresh', {
    status: 405,
  })
}

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-meta-token-refresh', {
      status: 401,
    })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-meta-token-refresh', { status: 401 })
  }

  try {
    const result = await runMetaTokenRefreshTick()
    const status = result.success ? 200 : 500
    return jsonWithLeakGuard(
      {
        success: result.success,
        refreshedCount: result.refreshedCount,
        errors: result.errors,
      },
      'cron-meta-token-refresh.response',
      { status },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return jsonWithLeakGuard(
      { success: false, refreshedCount: 0, errors: [message] },
      'cron-meta-token-refresh',
      { status: 500 },
    )
  }
}
