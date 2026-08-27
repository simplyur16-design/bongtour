/**
 * KST 22:00–10:00 창에서 날짜마다 다른 시각 — 미등록 목록 수집(공급사당 3건) 후 등록대기 셀프힐·검증.
 * production + DATABASE_URL. 비활성: DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: instrumentation 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 힐 후 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: 야간 창 ingest — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 랜덤 — manifest
 */
import {
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING,
  registerPrePhotoIngestNightWindowId,
  shouldRunRegisterPrePhotoIngestNightTick,
} from '@/lib/register-pre-photo-ingest-night-window'

let ingestNightWindowRanId: string | null = null
let ingestNightTickRunning = false

export function startInstrumentationRegisterPrePhotoSelfHealCron(): void {
  if (process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      const tick = () => {
        void tickRegisterPrePhotoSelfHealCron()
      }
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING, tick, { timezone: 'Asia/Seoul' })
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING, tick, { timezone: 'Asia/Seoul' })
      console.log(
        '[register-pre-photo-self-heal-cron] registered: * 22-23 * * * + * 0-9 * * * (Asia/Seoul, random-per-night)',
      )
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
  const now = new Date()
  if (!shouldRunRegisterPrePhotoIngestNightTick(now, ingestNightWindowRanId)) return
  if (ingestNightTickRunning) return
  ingestNightTickRunning = true
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const result = await runRegisterPrePhotoDailyJob({ probeImageUrls: true })
    ingestNightWindowRanId = registerPrePhotoIngestNightWindowId(now)
    console.log('[register-pre-photo-self-heal-cron]', result)
  } catch (e) {
    console.error('[register-pre-photo-self-heal-cron] error', e)
  } finally {
    ingestNightTickRunning = false
  }
}
