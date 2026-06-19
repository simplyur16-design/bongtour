/**
 * PR 7 / PR (가)-9: 매일 KST 02:00 Meta 장기 토큰 갱신 (만료 30일 전).
 * worker/all: node-cron. 단일 web: POST /api/cron/meta-token-refresh (외부 스케줄러).
 */
export type MetaTokenRefreshTickResult = {
  success: boolean
  refreshedCount: number
  errors: string[]
}

export function startInstrumentationMetaTokenRefreshCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_META_TOKEN_REFRESH_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 2 * * *',
        () => {
          void tickMetaTokenRefreshCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[meta-token-refresh-cron] registered: 0 2 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[meta-token-refresh-cron] failed to load node-cron', e)
    })
}

/** HTTP cron·node-cron 공통 tick — BongMetaConnection 없으면 refreshedCount=0 */
export async function runMetaTokenRefreshTick(): Promise<MetaTokenRefreshTickResult> {
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    return { success: false, refreshedCount: 0, errors: ['DATABASE_URL unset'] }
  }

  const { prisma } = await import('@/lib/prisma')
  const conn = await prisma.bongMetaConnection.findUnique({
    where: { provider: 'meta' },
  })

  if (!conn) {
    return { success: true, refreshedCount: 0, errors: [] }
  }

  const now = new Date()
  if (conn.userTokenExpiresAt < now) {
    return {
      success: false,
      refreshedCount: 0,
      errors: ['token_expired_reauth_required'],
    }
  }

  const { shouldRefreshMetaToken, getValidMetaConnection } = await import(
    '@/lib/bong-marketing/meta-token-manager'
  )

  if (!shouldRefreshMetaToken(conn.userTokenExpiresAt, now)) {
    return { success: true, refreshedCount: 0, errors: [] }
  }

  const tokenBefore = conn.userAccessToken
  const refreshedAtBefore = conn.lastRefreshedAt?.getTime() ?? 0

  const updated = await getValidMetaConnection()
  if (!updated) {
    return {
      success: false,
      refreshedCount: 0,
      errors: ['meta_connection_unavailable_after_refresh'],
    }
  }

  const didRefresh =
    updated.userAccessToken !== tokenBefore ||
    (updated.lastRefreshedAt?.getTime() ?? 0) > refreshedAtBefore

  if (!didRefresh) {
    return {
      success: false,
      refreshedCount: 0,
      errors: ['token_refresh_failed'],
    }
  }

  return { success: true, refreshedCount: 1, errors: [] }
}

export async function tickMetaTokenRefreshCron(): Promise<MetaTokenRefreshTickResult> {
  try {
    const result = await runMetaTokenRefreshTick()
    if (result.success) {
      console.log('[meta-token-refresh-cron] tick ok', {
        refreshedCount: result.refreshedCount,
      })
    } else {
      console.error('[meta-token-refresh-cron] tick issues', result)
    }
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[meta-token-refresh-cron] error', e)
    return { success: false, refreshedCount: 0, errors: [message] }
  }
}
