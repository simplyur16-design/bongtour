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
 * REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: night ingest heal 상한·probe off — manifest
 * production + DATABASE_URL. 비활성: DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 */
import {
  isRegisterListingIngestCronEnabled,
  isRegisterPrePhotoHealOnlyCronEnabled,
  registerIngestNightMaxTotal,
  registerIngestShouldYieldToEsimSms,
  shouldRegisterRegisterListingIngestNightCron,
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
/**
 * KST — 셀프힐 cron 이 꺼진 프로세스(웹)에 사진·등록 스위치가 켜져 있을 때만.
 * 매시 30분. 하루 3번이면 배포 재시작에 실행이 끊겨 다음 8시간을 놓친다(11/21 22:30 실행이 22:45 배포로 중단).
 * 겹침은 autoPhotoTickRunning 으로 막는다.
 */
export const REGISTER_AUTO_PHOTO_WHEN_HEAL_DISABLED_CRON = '30 * * * *'
/** KST — 야간 창(22–10) 종료 직후 수집·힐 다이제스트 1통 */
export const REGISTER_PRE_PHOTO_INGEST_DIGEST_CRON = '5 10 * * *'

let healOnlyTickRunning = false
let autoPhotoTickRunning = false
let ingestNightTickRunning = false

/**
 * 셀프힐 틱이 이미 사진 작업을 부르는 프로세스에서는 두 번째 cron 을 만들지 않는다.
 * 셀프힐이 꺼져 있고 스위치가 하나라도 켜진 프로세스만 따로 등록한다.
 */
export function shouldScheduleStandaloneAutoPhotoCron(input: {
  healCronEnabled: boolean
  anySwitchOn: boolean
}): boolean {
  return input.healCronEnabled === false && input.anySwitchOn
}
const ingestNightLastAttemptAtMs: Record<string, number> = {}

/**
 * 웹은 DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1 로 셀프힐을 끄고,
 * 사진·등록 스위치는 웹에만 있다. 워커 힐 틱은 그때 switches_off 로 사진 작업을 건너뛴다.
 * REGRESSION-FREEZE[register-auto-photo-web-when-heal-disabled]: 셀프힐이 꺼진 프로세스에 스위치가 있으면 사진 작업만 등록 — manifest
 */
export function startInstrumentationRegisterAutoPhotoWhenHealDisabled(): void {
  const healCronEnabled = isRegisterPrePhotoHealOnlyCronEnabled()
  void import('@/lib/register-auto-photo-register-job')
    .then(({ autoRegisterSwitches }) => {
      const switches = autoRegisterSwitches()
      const anySwitchOn = switches.fill || switches.flip || switches.record
      if (!shouldScheduleStandaloneAutoPhotoCron({ healCronEnabled, anySwitchOn })) return
      return import('node-cron').then((m) => {
        const cron = m.default
        cron.schedule(
          REGISTER_AUTO_PHOTO_WHEN_HEAL_DISABLED_CRON,
          () => {
            void tickRegisterAutoPhotoWhenHealDisabled()
          },
          { timezone: 'Asia/Seoul' },
        )
        console.log(
          `[register-auto-photo-cron] registered: ${REGISTER_AUTO_PHOTO_WHEN_HEAL_DISABLED_CRON} (Asia/Seoul, heal cron disabled in this process)`,
        )
      })
    })
    .catch((e) => {
      console.error('[register-auto-photo-cron] failed to register', e)
    })
}

async function tickRegisterAutoPhotoWhenHealDisabled(): Promise<void> {
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[register-auto-photo-cron] skip: DATABASE_URL')
    return
  }
  if (healOnlyTickRunning || autoPhotoTickRunning) return
  autoPhotoTickRunning = true
  try {
    const { autoRegisterSwitches, runAutoPhotoRegisterJob } = await import(
      '@/lib/register-auto-photo-register-job'
    )
    const switches = autoRegisterSwitches()
    if (!switches.fill && !switches.flip && !switches.record) {
      console.log('[register-auto-photo-cron] auto-photo skip: switches_off')
      return
    }
    // REGRESSION-FREEZE[site-health-hourly-1122]: 매시 틱에서만 사진·SEO·AEO 점검을 같이 돌린다 — manifest
    const photo = await runAutoPhotoRegisterJob({ limit: 50, siteHealth: true })
    console.log(
      '[register-auto-photo-cron] auto-photo-done',
      JSON.stringify({
        scanned: photo.scanned,
        filled: photo.filled,
        fillFailed: photo.fillFailed,
        registered: photo.registered,
        held: photo.held,
        publicScanned: photo.publicScanned,
        siteHealth: photo.siteHealth,
        fillFailByReason: photo.fillFailByReason,
        heldByReason: photo.heldByReason,
      }),
    )
  } catch (e) {
    console.error('[register-auto-photo-cron] error', e)
  } finally {
    autoPhotoTickRunning = false
  }
}

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
      if (!shouldRegisterRegisterListingIngestNightCron()) {
        console.log(
          '[register-pre-photo-self-heal-cron] night ingest skipped on web — run ingest on worker only',
        )
        return
      }

      const ingestTick = () => {
        void tickRegisterPrePhotoIngestNightCron()
      }
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING, ingestTick, { timezone: 'Asia/Seoul' })
      cron.schedule(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING, ingestTick, { timezone: 'Asia/Seoul' })
      cron.schedule(
        REGISTER_PRE_PHOTO_INGEST_DIGEST_CRON,
        () => {
          void import('@/lib/register-pre-photo-ingest-digest').then(({ maybeSendRegisterPrePhotoIngestDigest }) =>
            maybeSendRegisterPrePhotoIngestDigest(),
          )
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(
        '[register-pre-photo-self-heal-cron] night ingest registered: * 22-23 * * * + * 0-9 * * * (Asia/Seoul, until-quota)',
      )
      console.log(
        `[register-pre-photo-self-heal-cron] ingest digest registered: ${REGISTER_PRE_PHOTO_INGEST_DIGEST_CRON} (Asia/Seoul)`,
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
  // REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: ingest 중 heal-only 스킵 — manifest
  if (ingestNightTickRunning) {
    console.log('[register-pre-photo-heal-only-cron] skip: ingest night tick running')
    return
  }
  if (healOnlyTickRunning) return
  healOnlyTickRunning = true
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const { registerPrePhotoHealOnlyOpts } = await import('@/lib/register-pre-photo-ingest-db-budget')
    const budget = registerPrePhotoHealOnlyOpts()
    // REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: skipIngest: true 리터럴 유지 — manifest
    const result = await runRegisterPrePhotoDailyJob({
      skipIngest: true,
      probeImageUrls: budget.probeImageUrls,
      healLimit: budget.healLimit,
    })
    console.log('[register-pre-photo-heal-only-cron]', result)
    // REGRESSION-FREEZE[register-auto-photo-register-schedule]: 셀프힐과 같은 KST 시각에 사진 작업. 스위치가 모두 꺼지면 호출하지 않음. 이 틱의 healOnlyTickRunning 이 겹침을 막음 — manifest
    const { autoRegisterSwitches, runAutoPhotoRegisterJob } = await import(
      '@/lib/register-auto-photo-register-job'
    )
    const switches = autoRegisterSwitches()
    if (!switches.fill && !switches.flip && !switches.record) {
      console.log('[register-pre-photo-heal-only-cron] auto-photo skip: switches_off')
    } else {
      const photo = await runAutoPhotoRegisterJob({ limit: 50 })
      console.log(
        '[register-pre-photo-heal-only-cron] auto-photo-done',
        JSON.stringify({
          scanned: photo.scanned,
          filled: photo.filled,
          fillFailed: photo.fillFailed,
          fillFailByReason: photo.fillFailByReason,
          heldByReason: photo.heldByReason,
        }),
      )
    }
    const { recordRegisterPrePhotoIngestDigestFromJobResult, maybeSendRegisterPrePhotoIngestDigest } =
      await import('@/lib/register-pre-photo-ingest-digest')
    recordRegisterPrePhotoIngestDigestFromJobResult(result)
    // 창 종료 후 첫 heal-only(14:15 등)에서도 미발송이면 1회 시도
    void maybeSendRegisterPrePhotoIngestDigest()
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
  const yieldCheck = await registerIngestShouldYieldToEsimSms()
  if (yieldCheck.skip) {
    console.log(
      `[register-pre-photo-self-heal-cron] skip ingest: esim notify pending ${yieldCheck.pending}`,
    )
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
  const createdTotal = Object.values(createdTonight).reduce((a, n) => a + n, 0)
  const maxTotal = registerIngestNightMaxTotal()
  if (createdTotal >= maxTotal) {
    console.log(
      '[register-pre-photo-self-heal-cron] skip ingest: night max total reached',
      JSON.stringify({ createdTotal, maxTotal }),
    )
    return
  }
  const quotaFilled = createdTonightFillsRegisterPrePhotoIngestQuota(createdTonight)
  if (!shouldRunRegisterPrePhotoIngestNightTick(now, quotaFilled)) return
  const nextSupplier = pickNextRegisterPrePhotoIngestNightSupplierAfterCooldown(
    createdTonight,
    ingestNightLastAttemptAtMs,
    now.getTime(),
  )
  if (!nextSupplier) return

  // REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: heal-only 와 동시 실행 금지 — manifest
  if (healOnlyTickRunning) {
    console.log('[register-pre-photo-self-heal-cron] skip ingest: heal-only tick running')
    return
  }
  ingestNightTickRunning = true
  ingestNightLastAttemptAtMs[nextSupplier] = now.getTime()
  try {
    const { runRegisterPrePhotoDailyJob } = await import('@/lib/register-pre-photo-daily-job')
    const { registerPrePhotoIngestNightHealOpts } = await import(
      '@/lib/register-pre-photo-ingest-db-budget'
    )
    const remainingSupplier = remainingRegisterPrePhotoIngestTonight(createdTonight, nextSupplier)
    const remainingTotal = Math.max(0, maxTotal - createdTotal)
    const remaining = Math.min(remainingSupplier, remainingTotal)
    if (remaining <= 0) return
    const budget = registerPrePhotoIngestNightHealOpts()
    const result = await runRegisterPrePhotoDailyJob({
      ...budget,
      onlySuppliers: [nextSupplier],
      perSupplier: remaining,
    })
    console.log('[register-pre-photo-self-heal-cron]', nextSupplier, remaining, result)
    const { recordRegisterPrePhotoIngestDigestFromJobResult } = await import(
      '@/lib/register-pre-photo-ingest-digest'
    )
    recordRegisterPrePhotoIngestDigestFromJobResult(result)
  } catch (e) {
    console.error('[register-pre-photo-self-heal-cron] error', e)
  } finally {
    ingestNightTickRunning = false
  }
}

/** 테스트·다이제스트용 — 야간 ingest tick 진입점 */
export async function __tickRegisterPrePhotoIngestNightCronForTest(): Promise<void> {
  await tickRegisterPrePhotoIngestNightCron()
}
