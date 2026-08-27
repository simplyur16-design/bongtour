import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { runRegisterPrePhotoDailyJob } from '@/lib/register-pre-photo-daily-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

/**
 * POST /api/cron/register-pre-photo-self-heal
 * 미등록 목록 수집(이미 있는 URL 스킵, 공급사당 3건) 후 등록대기 키워드·일정 셀프힐. 사진 생성 없음.
 * Header: x-bongtour-cron-secret
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: cron 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingest then heal — manifest
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

  try {
    const result = await runRegisterPrePhotoDailyJob({
      dryRun,
      probeImageUrls,
      healLimit: Number.isFinite(limit) && (limit ?? 0) > 0 ? limit : 80,
      skipIngest,
    })
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
