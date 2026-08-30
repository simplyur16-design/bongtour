/**
 * KST 22:00–10:00 창에서 공급사당 신규 3건을 채울 때까지 이어 돈다.
 * 틱마다 한 공급사만. 사람 간격으로 12시간을 쓴다.
 * 이미 등록대기가 있어도(예: 12건) 오늘 밤 신규만 센다. leftover로 멈추지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 * production + DATABASE_URL. 비활성: DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: instrumentation 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 힐 후 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: 야간 창 ingest — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: 창 동안 할당량까지 — manifest
 */
import {
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING,
  createdTonightFillsRegisterPrePhotoIngestQuota,
  pickNextRegisterPrePhotoIngestNightSupplierAfterCooldown,
  registerPrePhotoIngestNightWindowId,
  remainingRegisterPrePhotoIngestTonight,
  shouldRunRegisterPrePhotoIngestNightTick,
} from '@/lib/register-pre-photo-ingest-night-window'

let ingestNightTickRunning = false
const ingestNightLastAttemptAtMs: Record<string, number> = {}

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
        '[register-pre-photo-self-heal-cron] registered: * 22-23 * * * + * 0-9 * * * (Asia/Seoul, until-quota)',
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
  const windowId = registerPrePhotoIngestNightWindowId(now)
  if (!windowId) return
  if (ingestNightTickRunning) return

  const { countRegisterPrePhotoIngestCreatedTonight } = await import(
    '@/lib/register-pre-photo-ingest-night-progress'
  )
  const createdTonight = await countRegisterPrePhotoIngestCreatedTonight(windowId)
  const quotaFilled = createdTonightFillsRegisterPrePhotoIngestQuota(createdTonight)
  if (!shouldRunRegisterPrePhotoIngestNightTick(now, quotaFilled)) return
  const nextSupplier = pickNextRegisterPrePhotoIngestNightSupplierAfterCooldown(
    createdTonight,
    ingestNightLastAttemptAtMs,
    now.getTime(),
  )
  if (!nextSupplier) return

  ingestNightTickRunning = true
  ingestNightLastAttemptAtMs[nextSupplier] = now.getTime()
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const remaining = remainingRegisterPrePhotoIngestTonight(createdTonight, nextSupplier)
    const result = await runRegisterPrePhotoDailyJob({
      probeImageUrls: true,
      onlySuppliers: [nextSupplier],
      perSupplier: remaining,
    })
    console.log('[register-pre-photo-self-heal-cron]', nextSupplier, remaining, result)
  } catch (e) {
    console.error('[register-pre-photo-self-heal-cron] error', e)
  } finally {
    ingestNightTickRunning = false
  }
}
