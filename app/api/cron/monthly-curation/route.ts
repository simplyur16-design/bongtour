import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import {
  ensureMonthlyCurationAutoSeed,
  ensureMonthlyCurationsForMonthKeys,
  monthlyCurationAutoTargetMonthKeys,
} from '@/lib/monthly-curation-auto'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-monthly-curation', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-monthly-curation', { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json()) as Record<string, unknown>) ?? {}
  } catch {
    body = {}
  }

  const overwrite = body.overwrite === true
  const rawMonths = body.monthKeys
  const monthKeys =
    Array.isArray(rawMonths) && rawMonths.every((m) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m.trim()))
      ? rawMonths.map((m) => (m as string).trim())
      : monthlyCurationAutoTargetMonthKeys()

  const results =
    Array.isArray(rawMonths) && rawMonths.length > 0
      ? await ensureMonthlyCurationsForMonthKeys(monthKeys, { overwrite })
      : await ensureMonthlyCurationAutoSeed({ overwrite })

  const failed = results.filter((r) => r.status === 'failed')
  const created = results.filter((r) => r.status === 'created')

  return jsonWithLeakGuard(
    {
      ok: failed.length === 0,
      monthKeys,
      created: created.length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: failed.length,
      results,
    },
    'cron-monthly-curation.response',
    failed.length > 0 ? { status: 207 } : undefined,
  )
}
