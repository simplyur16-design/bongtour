/**
 * 등록대기 셀프힐 cron — 수집(ingest)과 분리.
 * - heal-only: 하루 수회 skipIngest로 대기열 힐 (기본 ON)
 * - night ingest: ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1 일 때만 야간 창 수집+힐
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: instrumentation 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: ingest off여도 heal-only cron — manifest
 * REGRESSION-FREEZE[register-listing-ingest-opt-in]: listing ingest default off — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 힐 후 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: 야간 창 ingest — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: 창 동안 할당량까지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 * production + DATABASE_URL. 비활성: DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 */
import {
  isRegisterListingIngestCronEnabled,
  isRegisterPrePhotoHealOnlyCronEnabled,
} from '@/lib/register-listing-ingest-cron-gate'
import {
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING,
  createdTonightFillsRegisterPrePhotoIngestQuota,
  pickNextRegisterPrePhotoIngestNightSupplierAfterCooldown,
  registerPrePhotoIngestNightWindowId,
  remainingRegisterPrePhotoIngestTonight,
  shouldRunRegisterPrePhotoIngestNightTick,
} from '@/lib/register-pre-photo-ingest-night-window'

/** KST — 수집 없이도 대기열 힐 (06/14/22시) */
export const REGISTER_PRE_PHOTO_HEAL_ONLY_CRON = '15 6,14,22 * * *'

let healOnlyTickRunning = false
let ingestNightTickRunning = false
const ingestNightLastAttemptAtMs: Record<string, number> = {}

export function startInstrumentationRegisterPrePhotoSelfHealCron(): void {
  if (!isRegisterPrePhotoHealOnlyCronEnabled()) {
    console.log(
      '[register-pre-photo-self-heal-cron] skipped — DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1',
    )
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(REGISTER_PRE_PHOTO_HEAL_ONLY_CRON, () => {
        void tickRegisterPrePhotoHealOnlyCron()
      }, { timezone: 'Asia/Seoul' })
      console.log(
        `[register-pre-photo-self-heal-cron] heal-only registered: ${REGISTER_PRE_PHOTO_HEAL_ONLY_CRON} (Asia/Seoul, skipIngest)`,
      )

      // REGRESSION-FREEZE[register-listing-ingest-opt-in]: listing ingest default off — manifest
      if (!isRegisterListingIngestCronEnabled()) {
        console.log(
          '[register-pre-photo-self-heal-cron] night ingest skipped — ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1 to resume',
        )
        return
      }

      const ingestTick = () => {
        void tickRegisterPrePhotoIngestNightCron()
      }
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING, ingestTick, { timezone: 'Asia/Seoul' })
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING, ingestTick, { timezone: 'Asia/Seoul' })
      console.log(
        '[register-pre-photo-self-heal-cron] night ingest registered: * 22-23 * * * + * 0-9 * * * (Asia/Seoul, until-quota)',
      )
    })
    .catch((e) => {
      console.error('[register-pre-photo-self-heal-cron] failed to load node-cron', e)
    })
}

/** 대기열만 힐 — 수집 없음. GitHub Actions·서버 공통 경로. */
async function tickRegisterPrePhotoHealOnlyCron(): Promise<void> {
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[register-pre-photo-heal-only-cron] skip: DATABASE_URL')
    return
  }
  if (healOnlyTickRunning) return
  healOnlyTickRunning = true
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const result = await runRegisterPrePhotoDailyJob({
      skipIngest: true,
      probeImageUrls: true,
      healLimit: 200,
    })
    console.log('[register-pre-photo-heal-only-cron]', result)
  } catch (e) {
    console.error('[register-pre-photo-heal-only-cron] error', e)
  } finally {
    healOnlyTickRunning = false
  }
}

async function tickRegisterPrePhotoIngestNightCron(): Promise<void> {
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
