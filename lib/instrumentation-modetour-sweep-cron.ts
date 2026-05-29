/**
 * modetour 일1회 sweep — KST 04:00 `POST /api/cron/modetour-sweep`.
 * production + DATABASE_URL + BONGTOUR_CRON_SECRET + 내부 베이스 URL 필요.
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

export function startInstrumentationModetourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_MODETOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 4 * * *',
        () => {
          void tickModetourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[modetour-sweep-cron] registered: 0 4 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[modetour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickModetourSweepCron() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[modetour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { getBongtourCronSecret } = await import('@/lib/cron-auth')
    const secret = getBongtourCronSecret()
    if (!secret) {
      console.warn('[modetour-sweep-cron] skip: BONGTOUR_CRON_SECRET')
      return
    }
    const base = resolveInternalSiteBase()
    if (!base) {
      console.warn('[modetour-sweep-cron] skip: no NEXT_PUBLIC_SITE_URL / SITE_URL / NEXTAUTH_URL')
      return
    }
    const res = await fetch(`${base}/api/cron/modetour-sweep`, {
      method: 'POST',
      headers: { 'x-bongtour-cron-secret': secret },
    })
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      processed?: number
      updated?: number
      retired?: number
      skipped?: number
      pruned?: number
      error?: string
    }
    console.log('[modetour-sweep-cron]', res.status, j)
  } catch (e) {
    console.error('[modetour-sweep-cron] error', e)
  }
}
