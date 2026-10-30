import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { runAutoPhotoRegisterJob, autoRegisterSwitches } from '@/lib/register-auto-photo-register-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

let running = false

/**
 * POST /api/cron/register-auto-photo-register
 * 등록대기(검증 통과) → 사진 자동 채움(process-images) → 자동 검사 → 통과만 registered.
 * 셀프힐 cron 과 분리(셀프힐은 사진 생성 금지 freeze 유지).
 * Header: x-bongtour-cron-secret. Query: limit= (최대 50, 기본 20), scheduled=1 (정기 호출 — 스위치 모두 꺼짐이면 바로 건너뜀)
 * 정기 호출: .github/workflows/register-pre-photo-self-heal.yml 의 셀프힐 다음 단계(KST 06:15/14:15/22:15 + 15분).
 * 스위치(기본 꺼짐): BONGTOUR_AUTO_PHOTO_FILL / BONGTOUR_AUTO_REGISTER_FLIP / BONGTOUR_AUTO_REGISTER_RECORD
 * 모두 꺼져 있으면 읽기·검사 보고만 한다.
 * REGRESSION-FREEZE[register-auto-register-gate]: 기본 꺼짐, 202 ACK 백그라운드 — manifest
 */
export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-auto-photo-register', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-auto-photo-register', { status: 401 })
  }
  const url = new URL(req.url)
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, limitRaw) : 20
  const switches = autoRegisterSwitches()
  // REGRESSION-FREEZE[register-auto-photo-register-schedule]: 정기 호출(scheduled=1)은 스위치가 모두 꺼져 있으면 아무것도 안 함 — manifest
  const scheduled = url.searchParams.get('scheduled') === '1'
  if (scheduled && !switches.fill && !switches.flip && !switches.record) {
    return jsonWithLeakGuard(
      { ok: true, started: false, skipped: true, reason: 'switches_off', switches },
      'cron-auto-photo-register.response',
      { status: 202 },
    )
  }
  if (running) {
    return jsonWithLeakGuard(
      { ok: true, started: false, skipped: true, reason: 'already_running', switches },
      'cron-auto-photo-register.response',
      { status: 202 },
    )
  }
  running = true
  void runAutoPhotoRegisterJob({ limit })
    .then((r) => console.log('[cron/register-auto-photo-register] done', JSON.stringify(r)))
    .catch((e) => console.error('[cron/register-auto-photo-register] error', e))
    .finally(() => {
      running = false
    })
  return jsonWithLeakGuard(
    { ok: true, started: true, limit, switches },
    'cron-auto-photo-register.response',
    { status: 202 },
  )
}
