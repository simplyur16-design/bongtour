/**
 * MonthlyCurationContent — 매달 1일 00:00 KST `POST /api/cron/monthly-curation`.
 * 서버 기동 시 +1·+2달 데이터 없으면 1회 시드.
 * `BONGTOUR_CRON_SECRET`, 내부 베이스 URL, `DATABASE_URL`, production 필요.
 */
function resolveInternalSiteBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.BONGTOUR_API_BASE?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ''
  return raw.replace(/\/$/, '')
}

async function seedMonthlyCurationOnStartup(): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[monthly-curation-cron] startup seed skip: DATABASE_URL')
      return
    }
    const { ensureMonthlyCurationAutoSeed } = await import('@/lib/monthly-curation-auto')
    const results = await ensureMonthlyCurationAutoSeed()
    const created = results.filter((r) => r.status === 'created')
    const skipped = results.filter((r) => r.status === 'skipped')
    if (created.length === 0 && skipped.length === results.length) {
      console.log('[monthly-curation-cron] startup seed skip: all targets exist')
      return
    }
    console.log('[monthly-curation-cron] startup seed', { results })
  } catch (e) {
    console.error('[monthly-curation-cron] startup seed error', e)
  }
}

export function startInstrumentationMonthlyCurationCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_MONTHLY_CURATION_CRON === '1') {
    return
  }

  void seedMonthlyCurationOnStartup()

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 0 1 * *',
        () => {
          void tickMonthlyCurationCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[monthly-curation-cron] registered: 0 0 1 * * (Asia/Seoul) — +1/+2 month')
    })
    .catch((e) => {
      console.error('[monthly-curation-cron] failed to load node-cron', e)
    })
}

async function tickMonthlyCurationCron() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[monthly-curation-cron] skip: DATABASE_URL')
      return
    }
    const { getBongtourCronSecret } = await import('@/lib/cron-auth')
    const secret = getBongtourCronSecret()
    if (!secret) {
      console.warn('[monthly-curation-cron] skip: BONGTOUR_CRON_SECRET')
      return
    }
    const base = resolveInternalSiteBase()
    if (!base) {
      console.warn('[monthly-curation-cron] skip: no NEXT_PUBLIC_SITE_URL / SITE_URL / NEXTAUTH_URL')
      return
    }
    const res = await fetch(`${base}/api/cron/monthly-curation`, {
      method: 'POST',
      headers: {
        'x-bongtour-cron-secret': secret,
        'content-type': 'application/json',
      },
      body: '{}',
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: number; results?: unknown[] }
    console.log('[monthly-curation-cron]', res.status, j)
  } catch (e) {
    console.error('[monthly-curation-cron] error', e)
  }
}
