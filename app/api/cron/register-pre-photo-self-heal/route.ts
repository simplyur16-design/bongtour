import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { runRegisterPrePhotoDailyJob } from '@/lib/register-pre-photo-daily-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

/** Railway/GHA 프록시가 동기 힐(~수 분)을 502로 끊음 → 기본은 202 ACK 후 백그라운드 실행 */
let healJobRunning = false

/**
 * POST /api/cron/register-pre-photo-self-heal
 * 미등록 목록 수집(이미 있는 URL 스킵, 공급사당 3건) 후 등록대기 키워드·일정 셀프힐. 사진 생성 없음.
 * Header: x-bongtour-cron-secret
 * Query: suppliers=hanatour,modetour (optional), perSupplier=3 (optional), limit= heal cap,
 *        skipIngest=1, dryRun=1, probe=0, sync=1 (동기 대기 — 로컬/디버그용, GHA는 쓰지 않음)
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: cron 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingest then heal — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: default healLimit 200 / skipIngest / 202 ACK — manifest
 * healPendingRegisterPrePhoto 는 runRegisterPrePhotoDailyJob 안에서만 호출.
 */
export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-register-pre-photo', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-register-pre-photo', { status: 401 })
  }

  const url = new URL(req.url)
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw != null ? Number.parseInt(limitRaw, 10) : undefined
  const dryRun = url.searchParams.get('dryRun') === '1'
  const probeImageUrls = url.searchParams.get('probe') !== '0'
  const skipIngest = url.searchParams.get('skipIngest') === '1'
  const sync = url.searchParams.get('sync') === '1'
  const suppliersRaw = (url.searchParams.get('suppliers') ?? '').trim()
  const onlySuppliers = suppliersRaw
    ? suppliersRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : undefined
  const perSupplierRaw = url.searchParams.get('perSupplier')
  const perSupplierParsed =
    perSupplierRaw != null ? Number.parseInt(perSupplierRaw, 10) : Number.NaN
  const perSupplier =
    Number.isFinite(perSupplierParsed) && perSupplierParsed >= 1
      ? Math.min(10, Math.floor(perSupplierParsed))
      : undefined

  const healLimit =
    Number.isFinite(limit) && (limit ?? 0) > 0 ? Math.min(200, Math.floor(limit as number)) : 200
  const jobOpts = {
    dryRun,
    probeImageUrls,
    healLimit,
    skipIngest,
    onlySuppliers,
    perSupplier,
  }

  if (sync) {
    try {
      const result = await runRegisterPrePhotoDailyJob(jobOpts)
      return jsonWithLeakGuard({ ok: true, ...result }, 'cron-register-pre-photo.response')
    } catch (e) {
      console.error('[cron/register-pre-photo-self-heal]', e)
      return jsonWithLeakGuard(
        { ok: false, error: 'heal_failed' },
        'cron-register-pre-photo',
        { status: 500 },
      )
    }
  }

  if (healJobRunning) {
    return jsonWithLeakGuard(
      { ok: true, started: false, skipped: true, reason: 'already_running' },
      'cron-register-pre-photo.response',
      { status: 202 },
    )
  }

  healJobRunning = true
  void runRegisterPrePhotoDailyJob(jobOpts)
    .then((result) => {
      console.log('[cron/register-pre-photo-self-heal] background done', result)
    })
    .catch((e) => {
      console.error('[cron/register-pre-photo-self-heal] background error', e)
    })
    .finally(() => {
      healJobRunning = false
    })

  return jsonWithLeakGuard(
    { ok: true, started: true, healLimit, skipIngest, dryRun },
    'cron-register-pre-photo.response',
    { status: 202 },
  )
}
