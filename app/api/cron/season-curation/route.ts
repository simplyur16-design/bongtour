import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { rotateCycleIfDue } from '@/lib/season-curation'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-season-curation', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-season-curation', { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json()) as Record<string, unknown>) ?? {}
  } catch {
    body = {}
  }
  const force = body.force === true

  const result = await rotateCycleIfDue(new Date(), { force })
  if (result.message && !result.cycle) {
    return jsonWithLeakGuard({ ok: false, ...result }, 'cron-season-curation', { status: 500 })
  }
  return jsonWithLeakGuard({ ok: true, ...result }, 'cron-season-curation.response')
}
