/**
 * 매일 KST 06:30 — 미등록 목록 수집(나라 1 또는 도시별 1) 후 등록대기 셀프힐·검증.
 * production + DATABASE_URL. 비활성: DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: instrumentation 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 힐 후 검증 스탬프 — manifest
 */
export function startInstrumentationRegisterPrePhotoSelfHealCron(): void {
  if (process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '30 6 * * *',
        () => {
          void tickRegisterPrePhotoSelfHealCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[register-pre-photo-self-heal-cron] registered: 30 6 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[register-pre-photo-self-heal-cron] failed to load node-cron', e)
    })
}

async function tickRegisterPrePhotoSelfHealCron(): Promise<void> {
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[register-pre-photo-self-heal-cron] skip: DATABASE_URL')
    return
  }
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const result = await runRegisterPrePhotoDailyJob({ probeImageUrls: true })
    console.log('[register-pre-photo-self-heal-cron]', result)
  } catch (e) {
    console.error('[register-pre-photo-self-heal-cron] error', e)
  }
}
