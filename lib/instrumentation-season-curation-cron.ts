/**
 * SeasonalDestinationCuration — 매달 1일 00:00 KST `POST /api/cron/season-curation`.
 * `BONGTOUR_CRON_SECRET`, 내부 베이스 URL(`NEXT_PUBLIC_SITE_URL` 등), `DATABASE_URL` 필요.
 * (메모리 #30 — `getBongtourCronSecret` + `x-bongtour-cron-secret` SSOT)
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

/** 서버 기동 시 활성 사이클이 없으면 1회 시드(첫 배포·재시작). */
async function seedSeasonCurationCycleOnStartup(): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[season-curation-cron] startup seed skip: DATABASE_URL')
      return
    }
    const { getCurrentCycle, rotateCycleIfDue } = await import('./season-curation')
    const now = new Date()
    const current = await getCurrentCycle(now)
    if (current) {
      console.log('[season-curation-cron] startup seed skip: active cycle exists')
      return
    }
    const result = await rotateCycleIfDue(now, { force: true })
    console.log('[season-curation-cron] startup seed', {
      rotated: result.rotated,
      cycleId: result.cycle?.id ?? null,
      message: result.message,
    })
  } catch (e) {
    console.error('[season-curation-cron] startup seed error', e)
  }
}

export function startInstrumentationSeasonCurationCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_SEASON_CURATION_CRON === '1') {
    return
  }

  void seedSeasonCurationCycleOnStartup()

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 0 1 * *',
        () => {
          void tickSeasonCurationCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[season-curation-cron] registered: 0 0 1 * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[season-curation-cron] failed to load node-cron', e)
    })
}

async function tickSeasonCurationCron() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[season-curation-cron] skip: DATABASE_URL')
      return
    }
    const { getBongtourCronSecret } = await import('@/lib/cron-auth')
    const secret = getBongtourCronSecret()
    if (!secret) {
      console.warn('[season-curation-cron] skip: BONGTOUR_CRON_SECRET')
      return
    }
    const base = resolveInternalSiteBase()
    if (!base) {
      console.warn('[season-curation-cron] skip: no NEXT_PUBLIC_SITE_URL / SITE_URL / NEXTAUTH_URL')
      return
    }
    const res = await fetch(`${base}/api/cron/season-curation`, {
      method: 'POST',
      headers: {
        'x-bongtour-cron-secret': secret,
        'content-type': 'application/json',
      },
      body: '{}',
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; rotated?: boolean }
    console.log('[season-curation-cron]', res.status, j)
  } catch (e) {
    console.error('[season-curation-cron] error', e)
  }
}
