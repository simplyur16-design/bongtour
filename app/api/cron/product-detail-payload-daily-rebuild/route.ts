import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { runProductDetailPayloadDailyRebuild } from '@/lib/product-detail-payload-daily-rebuild'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard(
      { error: 'cron_secret_unconfigured' },
      'cron-product-detail-payload-daily-rebuild',
      { status: 401 },
    )
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard(
      { error: 'unauthorized' },
      'cron-product-detail-payload-daily-rebuild',
      { status: 401 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json()) as Record<string, unknown>) ?? {}
  } catch {
    body = {}
  }
  const dryRun = body.dryRun === true

  try {
    const result = await runProductDetailPayloadDailyRebuild({ dryRun })
    return jsonWithLeakGuard(
      { success: true, dryRun, ...result },
      'cron-product-detail-payload-daily-rebuild.response',
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return jsonWithLeakGuard(
      { ok: false, message },
      'cron-product-detail-payload-daily-rebuild',
      { status: 500 },
    )
  }
}
